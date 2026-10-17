# 02 — Revisão do código da Fase 1B

## Estado Git na entrada (verificado, não presumido)

| | Backend | Frontend |
|---|---|---|
| Branch | `feat/gsm-crm-ux-phase-1b` | `feat/gsm-crm-ux-phase-1b` |
| HEAD | `1f965ea` (Fase 0) | `f804b2c` (Fase 1A consolidada na `main`: `5b2d545` + docs) |
| Árvore | só arquivos da 1B (5 de produção + 2 de teste) | só arquivos da 1B (código, testes, `docs/.../fase-1b`, matriz) |
| Alterações não relacionadas | **nenhuma** | **nenhuma** (`package.json` intocado) |
| Migrations | **nenhuma** | — |

A 1A está consolidada: `5b2d545` e `f804b2c` no histórico do frontend, `1f965ea` no backend. A 1B foi commitada em **commits exclusivos** (ver `11`), depois a estabilização seguiu em `test/gsm-crm-phase-1b-stabilization`.

## Escopo revisado

`utils/leadImport.ts`, `LeadImportModal.tsx`, `LeadsApiRepository`, `LeadsMockRepository`, `useLeadActions`, `leads/adapters/inbound/router.py`, `use_cases.py` (`BulkImportLeadsUseCase`), `repository.py`, `core/idempotency.py`, os testes de importação/autorização e os componentes do Pipeline da 1B. Permissões, contratos e RLS foram conferidos contra os testes de matriz de rotas (verdes) e o diff (nenhuma permissão tocada).

## Achados (antes de corrigir)

| # | Sev. | Achado | Evidência | Ação |
|---|---|---|---|---|
| A1 | **CRÍTICO** | **R1 real**: importações simultâneas com o mesmo telefone novo duplicam (298 leads em vez de 150; 273 em vez de 80). Mascarado na 1ª importação do tenant por um INSERT de `lead_sources` que serializa por acidente. | testes de concorrência reproduzidos **sem** o lock | **corrigido** — `05` |
| A2 | **CRÍTICO** | **Linha "venenosa"**: valor maior que a coluna (company 201, notes 4001, phone 31…) → `StringDataRightTruncation` → **500 no lote inteiro**; 500 é repetido e falha sempre → importação irrecuperável. | 7 testes falhando antes da correção | **corrigido** (servidor + navegador) — `07` |
| A3 | ALTO | **R4**: a janela de retomada era **renovada** a cada tentativa (`at: Date.now()`); registros de ≥ 24 h eram **apagados**, então reabrir a planilha não avisava nada (com "duplicar", regravava em silêncio); "Retomar" na mesma tela não conferia idade; um registro por usuário. | leitura do código + testes novos | **corrigido** — `06` |
| A4 | ALTO | **Sem timeout de requisição**: um lote pendurado travava a importação para sempre (sem poder cancelar o lote em voo). | `ApiClient` sem `AbortSignal` | **corrigido**: 120 s por lote → falha de rede → reenvio com a mesma chave |
| A5 | MÉDIO | Reserva "presa" > 60 s assumida por reenvio enquanto a 1ª execução ainda roda → possível dupla gravação. | análise de `idempotency._begin` | **mitigado**: releitura da chave após o lock (`completed_replay`); lote de 500 linhas ≈ 6 s (10× abaixo de 60 s) |
| A6 | MÉDIO | Importação seguia **rodando invisível** se a pessoa navegasse para outra rota do app (`mounted` só silenciava `setState`). | leitura do código | **corrigido**: ao desmontar a tela, a importação para depois do lote atual e a retomada continua disponível — `07` |
| A7 | BAIXO | Cabeçalhos "UF"/"Estado" não são reconhecidos (rótulo é "Estado (UF)"): a coluna é ignorada se a pessoa não mapear. | E2E de dados mistos | **registrado** (UX), não alterado |
| A8 | BAIXO | Criar/editar lead **manualmente** com campo acima do limite → 500 (mesma causa de A2, outro endpoint). | análise | **registrado** em `12`, fora do escopo |
| A9 | INFO | Duplicação entre `LeadImportModal` e `ProspectImportModal` (a de prospects ficou só com a11y). | leitura | registrado |
| A10 | INFO | Testes Vitest/jsdom **não** provam layout real de CSS, foco e `<progress>` (R9). | — | coberto agora por E2E em navegador real |

## Testes: o que era insuficiente

A 1B tinha 35 testes de backend, mas **nenhum com concorrência real entre importações independentes**, nenhum de expiração/limite do TTL, nenhum de linha com valor longo e nenhum teste de navegador real. Os "testes de retomada" usavam `localStorage` simulado. Todos esses buracos foram fechados nesta estabilização (ver `10`).

## O que estava correto

Isolamento por tenant+usuário+operação da chave; resposta gravada na mesma transação do lote; liberação da chave em falha; 409/422; auditoria sem PII; neutralização de fórmulas; permissões intactas (matriz de rotas verde); contrato de API aditivo (header e campo opcionais).
