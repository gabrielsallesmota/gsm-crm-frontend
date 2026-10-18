# 11 — Handoff para o Prompt 07 (drawer do lead)

## Estado de entrada

- Branch do redesign: `feat/gsm-crm-redesign-pipeline` (frontend), **sem commit** — 17 arquivos modificados + novos (lista em `04`). Base: `b28e119` (estabilização). Backend: `e8cda1c` (estabilização), sem mudanças nesta fase.
- Antes do Prompt 07: **revisar e autorizar o commit** do redesign (sugestão: `feat(pipeline): redesign do Pipeline com Design System, filtros por chips e mobile por etapas`).
- Decisões a tomar antes de começar (de `10`): D-01/D-09 (sinais de atenção e soma por etapa), P6 (commit antes da resposta no backend), menu "⋯" por cartão, filtros na URL.

## O que o drawer pode reaproveitar

| Recurso | Onde | Observação |
|---|---|---|
| Tokens (`--space-*`, `--fs-*`, `--radius-*`, `--shadow-*`, `--z-*`, `--ease/--dur*`) | `styles/theme.css` | usar **só** estes; novo valor = novo token |
| `Icons` (11), `FilterChip`, `Avatar`, `Badge`, `Button`, `Modal`/`ConfirmDialog` | `components/common/` | ícones são decorativos; nome acessível no botão |
| `useMediaQuery`/`useIsMobile` + `BREAKPOINTS` | `hooks/useMediaQuery.ts` | cortes 760/900 |
| Padrão "disclosure" (`aria-expanded` + `aria-controls` + `hidden`) | `PipelineFilters.tsx` | para seções recolhíveis do drawer |
| Padrão de estados (esqueleto, vazio, erro com retry, "Movendo…") | `KanbanColumn.tsx` | |
| Regras puras testáveis em Node | `utils/pipelineView.ts` | `leadAge` ("Criado há…"), `describePeriod` |

## Contratos que o Pipeline espera do drawer (não quebrar)

- `LeadDrawer` recebe `lead`, `stages`, `templates`, `onClose`, `onSaved(lead)`, `onDeleted()`; o Pipeline chama `board.applyLead` e `board.reload`. Nome do diálogo: **"Lead <nome>"**; botão **"Fechar lead"**; "Excluir lead" abre `ConfirmDialog` "Excluir lead?" (E2E e vitest dependem disso).
- Abrir: clique/Enter/Espaço no cartão (`role="button"` "Abrir <nome>") — o foco deve **voltar ao cartão** ao fechar.
- Mudar etapa/responsável pelo drawer atualiza o quadro via `onSaved`.

## Armadilhas aprendidas (leia antes de mexer em layout/arrastar)

1. **Nunca insira/remova blocos no fluxo durante um arraste nativo** — o Chromium cancela o *drop*. Use sobreposição (`position: absolute; pointer-events: none`) ou espaço reservado. jsdom **não** pega isso; só o E2E real.
2. `.sr-only` é `position: absolute`: dentro de áreas roláveis precisa de um ancestral `position: relative` **dentro** do recorte, senão alarga a página.
3. `select:focus` global zera o contorno: dê `:focus-visible` explícito a selects que aparecem por foco.
4. `relatedTarget` é nulo em `dragenter/leave` no Chromium; decida por coordenadas.
5. WebKit/Safari **não** põe links na ordem de Tab por padrão.
6. `tests/ui/support/setup.ts` fornece `localStorage` em memória; `renderApp` invalida o cache compartilhado; procure alertas com `within(dialog)`.

## Como rodar

```
npm run lint && npm run typecheck && npm run test:unit && npx vitest run && npm run build
npm run e2e                       # ~25 min, 3 navegadores, ambiente isolado gsm_crm_e2e
E2E_REUSE=1 npm run e2e -- --project=chromium -g "redesign"
npx playwright test e2e/visual-evidence.spec.ts --project=chromium   # regenera as capturas
```

Seletores de teste do quadro: `[data-stage-column][data-stage-name]`, `[data-stage-count]`, `[data-stage-header]`, `[data-stage-move]`, `[data-lead-id]`. Tenants do E2E: faixas em `e2e/support/env.ts` (redesign 111–118; evidências 101–110).

## Fora do escopo desta fase (continua pendente)

Drawer (Prompt 07), assistente de importação CSV e Configurações (Prompt 08) — **intocados**. Leitor de tela real e dispositivos físicos: validação manual.
