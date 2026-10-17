# 03 — Acessibilidade remanescente

## PIP-04 — reordenar etapas sem arrastar

- Cada cabeçalho de coluna (só quem tem `pipeline.reorder`: admin e gestor) ganhou dois botões: **"Mover etapa X para a esquerda/direita"**. Nas pontas, o botão fica `disabled`.
- Usa a mesma chamada do arrastar (`reorderStages`) com a ordem completa, via `reorderIds`.
- Após o sucesso: toast **"Etapa X movida para a posição N de M"** (região viva dos toasts) e recarga das etapas.
- **Foco preservado**: a recarga reordena nós do DOM; um efeito devolve o foco ao mesmo botão (ou ao oposto, se a etapa chegou à ponta e o botão foi desabilitado).
- Falha da API: toast de erro, sem recarga, ordem inalterada. Vendedor não vê os botões. Arrastar continua funcionando.
- O último `it.fails` da suíte (PIP-04) virou teste comum `[CORRIGIDO 1B PIP-04]`.

## PIP-05 — mover lead sem arrastar, descobrível

O seletor "Mover … para outra etapa" ficava com `display: none` no desktop com mouse (fora da árvore de acessibilidade e do Tab). Agora, nesse contexto, fica **visualmente oculto** (clip de 1 px) e aparece quando o foco por teclado chega ao cartão (`.card:has(:focus-visible) .cardMove`) ou ao próprio seletor. `.card` ganhou `position: relative` para conter o elemento. Em telas de toque/estreitas continua sempre visível.
Teste de varredura do CSS: nenhum bloco de `.cardMove` pode conter `display:none`/`visibility:hidden`.

## PIP-12 — alvos de toque

`.btnSmall` (WhatsApp e e-mail do cartão): `min-height/min-width: 28px` (≥ 24 px, WCAG 2.2) e **44 px em `pointer: coarse`**. Os botões novos de etapa seguem a mesma regra.

## Prospecção interna

- `ProspectImportModal` migrado para o `Modal` compartilhado: `role=dialog`, `aria-modal`, nome, foco preso/devolvido, Esc, proteção de dados; fechamento bloqueado durante o envio; rótulos associados (`label/htmlFor`) em estágio e duplicados; `aria-label` no arquivo e em cada coluna do de/para; erro com `role="alert"`.
- Rótulos acessíveis: mensagens de WhatsApp da Prospecção (estágio, área, mensagem), estágios de prospecção em Configurações (novo e edição), novo motivo de perda e novo estágio nos modais de gestão, dias de cadência.

## Pendências de acessibilidade (não feitas)

`ProspectDrawer` (18 campos; só parte com rótulo — **não medido campo a campo**), verificação visual de foco/contraste nos dois temas e leitor de tela real: **MANUAL** (ver `09`).
