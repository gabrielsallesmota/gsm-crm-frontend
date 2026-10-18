# 09 — Responsividade

Verificada em **1920×1080, 1366×768, 768×1024 e 390×844**, temas claro e escuro, no navegador real (`a11y-lead-import.spec.ts`): em **todas** as combinações a página **não tem rolagem horizontal** (`scrollWidth − clientWidth ≤ 1`) e o diálogo do assistente cabe na janela (largura e altura).

## Painel do lead

| Largura | Comportamento |
|---|---|
| ≥ 540 px | painel lateral de 520 px à direita; resumo em 2 colunas; cabeçalho fixo e corpo rolável |
| ≤ 480 px | painel em largura total; **Etapa e Responsável** em linha inteira e o restante (valor, probabilidade, origem, criado em) em 2 colunas, para reduzir a rolagem; formulário em 1 coluna; ações rápidas quebram e se esticam |
| Edição | rodapé **fixo** (Cancelar/Salvar) dentro do painel: salvar não exige rolar até o fim, inclusive com teclado virtual aberto (testado ao focar "Notas" em 390 px) |

- Textos longos (empresa, e-mail) quebram com `overflow-wrap: anywhere`; nada alarga a página (E2E com empresa de 70 caracteres e e-mail longo).
- Timeline longa: 10 eventos iniciais + "Ver mais" evitam um painel gigante (E2E com 12 comentários).

## Assistente de CSV

| Largura | Comportamento |
|---|---|
| Desktop | modal de até 920 px, tabela de mapeamento em 3 colunas (coluna · exemplo · campo), lista com rolagem própria (46 vh) |
| ≤ 560 px | **tela cheia** (100dvh, respeitando safe-area), indicador mostra só o nome da etapa atual, mapeamento vira cartões empilhados, barra de ações fixa no rodapé com botões que ocupam a linha |

Mapeamento com muitas colunas: a lista rola dentro do diálogo; o cabeçalho (stepper) e a barra de ações permanecem acessíveis.

## Funcionalidades no celular

Nada foi escondido por ser mobile: ações rápidas, edição, comentários, tarefas, mover etapa, ver mais, importação completa (incluindo interromper/retomar) continuam disponíveis.

## Não medido

Teclado virtual real (iOS/Android) e dispositivos físicos: apenas emulação do Chromium. WebKit/Firefox foram usados nos testes funcionais `@cross` (fluxo completo do painel e importação), não nas auditorias de layout por resolução.
