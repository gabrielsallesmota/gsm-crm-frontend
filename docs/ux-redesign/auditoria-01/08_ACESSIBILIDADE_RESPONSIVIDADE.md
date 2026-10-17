# 08 — Acessibilidade (WCAG 2.2 AA) e responsividade

Base: inspeção estática do código + cálculo de contraste dos tokens (`src/styles/theme.css`, `global.css`). **Nenhum teste com leitor de tela, zoom 200/400 %, dispositivo real ou ferramenta automática (axe/Lighthouse) foi executado.** Itens marcados "exige teste manual" não devem ser dados como aprovados.

## Pontos fortes [C]

- Foco visível global: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` (`global.css:100-104`).
- `prefers-reduced-motion` respeitado globalmente (`global.css:153-160`).
- Texto só para leitor de tela (`.sr-only`), `HelpTip`, `aria-label` nos controles de cor e botões de ação.
- `Modal` e drawers: `role="dialog"`, `aria-modal`, nome acessível, foco inicial e devolvido, Tab preso, Esc, trava de rolagem e **pilha** de diálogos (`Modal.tsx`, `useDialog.ts`).
- Estados de erro com `role="alert"` (colunas, notificações); `aria-busy` no card em movimento; `aria-pressed` nos filtros e tags selecionáveis.
- Cartão do Pipeline operável por teclado (Tab + Enter/Espaço, `PipelinePage.tsx:485-493`).

## Problemas comprovados no código

| ID | WCAG | Problema | Evidência | Sev. |
|---|---|---|---|---|
| A-01 | 4.1.2, 1.3.1 | Controles interativos dentro de `role="button"` (card) | `PipelinePage.tsx:478-529` (PIP-01) | P1 |
| A-02 | 1.3.1, 3.3.2, 4.1.2 | Campos do painel do lead sem rótulo programático | `LeadDrawer.tsx:309-384` (DRW-01) | P1 |
| A-03 | 4.1.2, 2.1.2, 2.4.3 | Importação sem `role="dialog"`, foco preso, Esc | `LeadImportModal.tsx:141-142` (IMP-01) | P1 |
| A-04 | 1.3.1, 3.3.2 | Selects/inputs da importação, de Configurações e dos templates sem rótulo | IMP-06, CFG-06, CFG-07 | P2 |
| A-05 | 1.4.3 | `--faint` usado em texto: 3,46:1 (escuro) e 2,94:1 (claro) | `PipelinePage.module.css:181-186`, `LeadDrawer.module.css:~292`, calculado | P3 |
| A-06 | 2.5.8 | Botões WhatsApp/E-mail "small" ≈ 22 px | `prospects/WhatsappButton.module.css:25-28` (PIP-12) | P2 |
| A-07 | 2.1.1 | Reordenar colunas só por arrastar no quadro | `PipelinePage.tsx:380-385` (PIP-04); alternativa existe em Configurações | P2 |
| A-08 | 2.5.7 (arrastar) | Mover card: alternativa por `select` oculta no desktop com mouse e acessível por teclado só via painel | `PipelinePage.module.css:212-216` (PIP-05) | P2 |
| A-09 | 1.4.1, 4.1.3 | Contagem "…" e erros de importação sem `aria-live`; resultado da importação aparece sem anúncio | `PipelinePage.tsx:391-393`, `LeadImportModal.tsx:149-179` | P3 |
| A-10 | 3.3.1 | Erro de importação é uma linha de texto vermelho sem `role="alert"` | `LeadImportModal.tsx:276` | P2 |

Contraste calculado (razão sobre `--card-bg-alt`/`--card-bg`): tema escuro — `--text` 15,3 · `--muted` 7,3 · `--muted-2` 5,2 · **`--faint` 3,3** · `--accent` 10,9 · `--tone-red` 6,5; tema claro — `--muted-2` 4,84 · **`--faint` 2,94** · `--accent` (#12a550) sobre branco **3,22** (texto pequeno em verde no tema claro, ex. links `--accent`, precisa de verificação por uso) [P].

## Exige teste manual

- Leitor de tela (NVDA/VoiceOver) nos cartões do Pipeline, painel do lead, importação e Configurações.
- Zoom 200 % e 400 % (reflow, WCAG 1.4.10) no Pipeline: a barra de filtros, o painel (460 px) e as grades.
- Foco após fechar o painel/modal quando o card de origem foi removido do quadro (ex.: lead excluído).
- Ordem de foco do quadro com muitas colunas (tabulação por colunas × cards).
- Contraste de selos de origem/etiquetas (par texto/fundo translúcido) nos dois temas.
- Tamanho real dos alvos de toque em celular (≥ 24 px mínimo; recomendado 44 px).
- Arrastar com toque, caneta e leitores com controle por voz.

## Responsividade

| Área | Observação | Classe |
|---|---|---|
| Quadro | `grid-auto-columns: minmax(240px, 1fr)` com rolagem horizontal (`PipelinePage.module.css:86-93`); sem indicação de que há mais colunas à direita, sem cabeçalho fixo | [C] |
| Cabeçalho do Pipeline | sem `flex-wrap` nem `@media` (`:46-51`); em 1440 px (captura demo) a barra já usa duas linhas | [P] ≤ 768 px |
| Cards | seletor de etapa visível em toque/≤ 760 px (`:212-216`) | [C] |
| Painel do lead | tela cheia ≤ 480 px; grade em 1 coluna | [C]; validar no aparelho |
| Importação | modal de largura própria (`ProspectImportModal.module.css`, não verificado em estreito) | [V] |
| Configurações | `pipelineGrid` com `auto-fill, minmax(260px, 1fr)` e `stageEditForm` com `flex-wrap`: adaptável; `SettingsPage.module.css` não tem `@media` | [C] |
| Modal compartilhado | `@media (max-width: 480px)` e `560px` (`Modal.module.css:47, 92`) | [C] |

Recomendação: definir *breakpoints* únicos (≤ 640, 641–1024, > 1024), adotar alvos de 44 px em toque, rolagem do quadro com *snap* por coluna e indicador de colunas, e menu "Mais" para ações secundárias no celular.
