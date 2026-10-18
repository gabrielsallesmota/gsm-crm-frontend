# 06 — Integridade da importação

## O que NÃO mudou (verificado por diff e pelos testes)

`src/utils/leadImport.ts`, `LeadsApiRepository.bulkImport` e todo o backend de importação estão **sem nenhuma alteração** nesta fase. Isto preserva:

| Garantia | Onde vive |
|---|---|
| Limite de 10.000 linhas e 5 MB, checados **antes** de enviar | `checkLimits` |
| Lotes de até 500, sequenciais, em ordem | `chunk` / `runImport` |
| Idempotência: chave `imp-<id>-<n>` por lote, mesma chave em reenvios | `importKey` / `runImport` |
| Retentativas (3) só para falhas transitórias, mesma chave | `isRetryable` |
| Janela segura de retomada: 20 h do **início** (servidor guarda 24 h); nunca renovada | `RESUME_SAFE_MS`, `resumeStatus` |
| Expirou → **nada é reenviado**; "Preparar nova importação" recomeça com identidade nova e troca "duplicar" por "ignorar" | modal (`prepareFreshImport`) |
| Estratégias de duplicados `skip`/`update`/`duplicate` enviadas como escolhidas | parâmetro de `bulkImport` |
| Relatório por linha com o número ORIGINAL da linha na planilha | `buildReport` / `reportToCsv` (BOM, fórmulas neutralizadas) |
| Parar ao desmontar; `beforeunload` durante o envio | modal |
| Multi-tenant: registro de retomada por `(tenant, usuário, assinatura)` | `resumePrefix` |
| Locks transacionais, deduplicação, RLS, limites por campo | backend (intacto) |

Sem nova migration, sem endpoint novo, sem mudança de contrato.

## Retomada — o que a tela diz

- Na etapa de resultado, quando a importação **falhou** ou foi **interrompida**: "Você pode retomar esta importação até <data/hora> (20 h após o início). Depois disso o servidor esquece os lotes e reenviar poderia duplicar: a retomada é bloqueada."
- Se a janela já passou: "A janela segura de retomada (20 h) terminou: não é seguro reenviar os lotes. Prepare uma nova importação." — e ao clicar em *Retomar importação* o modal **bloqueia** e mostra o aviso "A proteção contra duplicação desta importação venceu… **Nada foi reenviado.**"
- A tela nunca sugere duplicar como recuperação (a opção vira "ignorar" ao preparar a nova importação).

## Cancelar × interromper × falhar

| Situação | O que a tela faz e diz |
|---|---|
| Antes de iniciar (etapas 1–3) | **Cancelar**/fechar: nada foi enviado; sem confirmação; o diálogo avisa "Nada foi enviado ainda" na revisão |
| Durante o processamento | **Interromper importação** → confirmação: "para depois do lote em andamento. O que já foi gravado permanece no CRM (não é desfeito)". O botão mostra "Interrompendo…" e o progresso diz "Interrompendo depois do lote em andamento…". Esc, fundo e × continuam bloqueados |
| Resultado "Cancelada" | "Você interrompeu a importação. Os lotes já enviados foram gravados e **continuam no CRM**; nada foi desfeito." + janela de retomada |
| Falha de rede/servidor | "Falhou": mensagem legível, "A importação parou no lote X de Y. Os lotes anteriores foram gravados; use Retomar importação para continuar sem duplicar." |
| Parcialmente concluída | linhas "Não confirmadas" no total, com orientação de usar *Retomar* (não importar de novo) |

Nenhum texto afirma que registros persistidos foram cancelados ou desfeitos.

## Evidências de teste

- UI (Vitest): 73 testes do assistente (67 anteriores adaptados + 6 novos) incluindo 500/501/2.000/10.000/10.001 linhas, lotes, chaves, falha parcial, retomada em 1 h/19 h/19 h 59/20 h/24 h/3 dias, expiração, tenants/usuários diferentes e abas simultâneas.
- E2E (Playwright, API real): suíte `import.spec.ts` existente executada contra o novo fluxo (500, 501, 10.000, inválido, duplicados, falha parcial, retomada, concorrência de abas, reinício do backend) — resultado em `10`.
- Backend: pytest completo verde, incluindo os testes de importação da estabilização.
