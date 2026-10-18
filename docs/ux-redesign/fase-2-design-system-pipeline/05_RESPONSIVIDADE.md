# 05 — Responsividade

Verificada em navegador real (Chromium, Firefox, WebKit) nas quatro resoluções do prompt e nos dois temas. Cortes: `760 px` (celular) e `900 px` (cabeçalho empilha); toque por `pointer: coarse`.

| Resolução | Comportamento | Evidência |
|---|---|---|
| **Desktop 1920 × 1080** | 4 colunas lado a lado (largura `clamp(264px, 23vw, 316px)`), cabeçalho em 2 linhas com ações à direita, filtros em 1 linha | `evidencias/pipeline-desktop-1920-claro.png`, `…-escuro.png` |
| **Notebook 1366 × 768** | mesma densidade; o quadro rola na horizontal **dentro dele**; coluna com rolagem própria (cabeçalho sempre à vista); sem desperdício vertical | `pipeline-notebook-1366-*.png` |
| **Tablet 768 × 1024** | cabeçalho empilhado (corte 900), filtros em 2 linhas, colunas rolam na horizontal dentro do quadro com `scroll-snap`; alvos de 28 px (mouse) | `pipeline-tablet-768-*.png` |
| **Mobile 390 × 844** | **uma etapa por vez**: abas de etapa (nome + total real) → coluna ativa; ações em 1 linha ("Novo lead", "Importar", "Exportar" — nome acessível completo mantido); busca + "Filtros" na 1ª linha, responsável/ordem na 2ª; seletor "mover" sempre visível; alvos de 44 px | `pipeline-mobile-390-*.png` |

## Correções de overflow (a página nunca rola na horizontal)

1. **WebKit/iPhone ~65 px (achado do Prompt 05)**: os dois campos `type="date"` do filtro de período têm largura intrínseca grande no WebKit. Agora ficam atrás de "Filtros" (fechado por padrão) e, abertos, têm `min-width: 0; max-width: 100%` e quebram linha. **Teste**: `page.evaluate(scrollWidth − clientWidth) ≤ 1` com o painel fechado **e aberto**, nos 3 navegadores.
2. **Textos `sr-only` das colunas fora da área visível** (achado nesta fase pelo E2E, 93 px em 768 px): elementos `position: absolute` cuja caixa de contenção ficava fora do quadro escapavam do recorte e alargavam a página. `.board { position: relative }` os contém.
3. **Menu lateral recolhido** (≤ 900 px) vazava `box-shadow: 20px 0 40px` como uma faixa cinza na borda esquerda e mantinha links invisíveis na ordem de Tab. Agora a sombra só existe aberto e `visibility: hidden` fechado (com atraso para não cortar a animação).

## Padrão por faixa

- **≥ 761 px com mouse** (`hover: hover` + `pointer: fine`): seletor "mover" visualmente oculto até o foco chegar ao cartão; setas de reordenar etapas reveladas por hover/foco.
- **Toque** (`pointer: coarse`): seletor "mover", setas de etapa, chips, botões e campos com **44 px**; nada depende de hover.
- **≤ 760 px**: `StageTabs` + só a coluna ativa no DOM; a página rola (a coluna não tem rolagem interna).

## Não coberto

Dispositivos físicos (iOS/Android reais) e gestos de arrastar com o dedo; o **arraste por toque não é suportado pela API HTML5 nativa** — por isso o seletor "mover" é o caminho em celular/tablet (decisão herdada de PIP-11).
