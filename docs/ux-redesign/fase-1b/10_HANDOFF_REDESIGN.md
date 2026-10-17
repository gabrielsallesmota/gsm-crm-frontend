# 10 — Handoff para o redesign

## Estado de entrada

- 1A já na `main` (frontend `5b2d545` + docs `f804b2c`; backend `1f965ea`). 1B em `feat/gsm-crm-ux-phase-1b`, **não commitada**.
- Antes de qualquer redesign: revisar e autorizar o commit da 1B (sugestão frontend: `feat(pipeline): ordenação global, importação em lotes e acessibilidade`; backend: `feat(leads): importação idempotente por lote e ordenação determinística`). Backend deve ir primeiro (o frontend envia `Idempotency-Key`, que o backend antigo ignora com segurança; `reason` ausente é tolerado).

## O que o redesign pode assumir

- Ordenação do quadro é **do servidor**; qualquer nova opção = só adicionar em `BOARD_SORT_OPTIONS` + `serverSortFor`.
- A importação é um **assistente com três fases** (preparar → processar → relatório) e um motor puro em `utils/leadImport.ts`. A tela pode ser redesenhada livremente; o contrato é `runImport`/`prepareRows`/`buildReport`.
- Os botões de etapa (`data-stage-move`) e o seletor "mover" têm contratos de acessibilidade testados; manter nomes acessíveis e foco.
- Alvos mínimos: 28 px (44 px em toque) — testes de varredura de CSS os protegem.

## Dependências para o redesign (não implementadas)

- **Indicadores/sinais no cartão** dependem de D-01 (última interação). Nenhum campo novo foi criado; `last_interaction_at` mantém a semântica.
- Layout do painel e do Kanban (D-07/D-08) e Configurações: fases 2–4.
- Teste visual/e2e (Playwright) segue sem autorização: mudanças de layout continuam sem rede visual.

## Regras que continuam valendo

Rodar a suíte inteira antes/depois; converter `it.fails`/`todo` ao implementar; procurar por IDs da auditoria nos nomes dos testes; `within(dialog)` para alertas (o `ToastHost` tem um `role=alert` vazio); `renderApp` invalida o cache compartilhado; `localStorage` de teste é em memória (setup.ts).
