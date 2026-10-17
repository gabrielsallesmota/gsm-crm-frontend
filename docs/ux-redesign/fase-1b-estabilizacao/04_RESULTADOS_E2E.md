# 04 — Resultados E2E (executados de verdade)

Execução completa: `npx playwright test` — API + front subidos pelo próprio Playwright, banco `gsm_crm_e2e` recriado, 300 tenants semeados, senha aleatória da execução. **20,1 min.**

## Resumo

| | Testes | Passaram | Falharam | Pulados |
|---|---|---|---|---|
| **Chromium** (suíte completa) | 89 | 88 | 0 | 1 (`restart`, manual) |
| **Firefox** (`@cross`) | 23 | 23 | 0 | 0 |
| **WebKit** (`@cross`) | 23 | 23 (2 deles são *falha esperada*, ver achado A) | 0 | 0 |
| **Total** | **135** | **134** | **0** | **1** |

`restart.spec.ts` (reinício REAL do backend) é manual por desenho; **foi executado separadamente** com servidores já em pé e passou (queda do processo da API no 2º lote → "Falhou" → API reiniciada → "Retomar" conclui com **1.500 telefones únicos**). Não faz parte do total acima.

Execuções anteriores da mesma suíte revelaram — e levaram a correções — defeitos reais (ver `02`): foco do seletor "mover" sem contorno, corrida de importações, linha venenosa, janela de retomada. Uma rodada completa intermediária teve 3 falhas, todas em WebKit: duas eram o achado A (layout) e uma era **corrida de sincronização do próprio teste** (o ajuste de espera `waitBoardIdle` passou a aguardar o contador da coluna).

## Cenários-chave com números

| Cenário | Resultado |
|---|---|
| Volumes 1 / 500 / 501 / 1.000 / **2.000 / 2.001 / 10.000** | todos concluídos; lotes de ≤ 500; **10.000 linhas = 20 lotes, ~1,9 min, 10.000 telefones únicos, nenhum perdido ou repetido** |
| 10.001 linhas / arquivo > 5 MB | bloqueados **antes** de qualquer requisição (0 envios) |
| Progresso real | resposta retida **depois** de o servidor gravar: servidor com 500, tela em 0; liberada, vai a 500; depois 1.000. Em 10.000 linhas o progresso amostrado é monotônico e **sempre múltiplo de 500** |
| Cancelar | termina o lote em voo; servidor com 500; retomar com "duplicar" não regrava o lote 1 → 1.000 únicos |
| Falhas 1º / 2º / último lote | lotes anteriores permanecem; "Retomar" grava só o que faltou; **relatório com números originais das linhas** |
| Timeout **depois** de gravar, estratégia "duplicar" | reenvio com a mesma chave → `Idempotent-Replayed: true` → **500 leads, não 1.000** |
| 429 / 500 / 409 repetem; 422 não repete | confirmado (chave idêntica nas tentativas) |
| Concorrência (R1) | 2 abas, 2 usuários, "duplicar" intencional, 2 tenants: **sem duplicação técnica; duplicação intencional preservada** |
| Retomada vencida (25 h) | 0 requisições; aviso; "Preparar nova importação" troca para "ignorar"; conclui sem duplicar |
| Sair da tela no meio | para depois do lote em voo (500 gravados) e retoma depois |
| Relatório CSV baixado | BOM, números de linha, fórmulas neutralizadas (`'=HYPERLINK(...)`, `'+cmd`) |
| Ordenação global | A-Z/Z-A sobre 60 leads (o 1º em A-Z era o último criado), por data, empates (80 leads / 2 nomes), troca no meio da paginação, resposta antiga atrasada descartada |
| Mover | arrastar, seletor, **teclado**, rollback com API 500, `aria-busy` |
| Reordenar etapas | teclado (foco preservado, aviso da posição), mouse, permissões, falha da API |
| Cross-browser (`@cross`, 23 testes em Firefox e em WebKit) | smoke (login, vazio, 1º lead); pipeline: poucos leads, >25/etapa, ordenação global A-Z/Z-A, arrastar, seletor, reordenar etapas por teclado; importação 1 / 500 / 501 / 1.000 linhas; Pipeline em 4 resoluções × 2 temas com axe e captura; foco por Tab; exclusão com confirmação; isolamento entre tenants; papéis. **Não** foram repetidos nos 2 navegadores: volumes ≥ 2.000, falhas de lote, retomada e concorrência (só Chromium). |

## Achados do E2E

- **A — WebKit/390 px:** a página rola ~65 px na horizontal (campos de data do filtro de período). Chromium/Firefox: não. Teste marcado `test.fail` (falha esperada) para o achado continuar visível. **Não é da 1B.**
- **B — contraste (axe, serious):** botão WhatsApp do cartão no **tema claro** (29 elementos). Pré-existente (R5 da 1A).
- **C — "UF"/"Estado"** não são reconhecidos automaticamente no de/para.

## NÃO EXECUTADO

| Item | Motivo |
|---|---|
| Leitor de tela (NVDA/VoiceOver) | indisponível; só atributos/árvore de acessibilidade |
| Arrastar com **toque real** (iOS/Android) | não automatizável; testado o seletor em emulação de celular |
| Sessão de suporte / staff GSM **na interface** | não semeada no ambiente E2E; coberto só no backend (`08`) |
| Importação ≥ 10.000 em **homologação autorizada** | só o ambiente local isolado foi usado |
| Teste de carga com várias importações grandes simultâneas | fora do escopo; medido só 2–6 simultâneas |
