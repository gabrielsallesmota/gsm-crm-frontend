# 09 — Acessibilidade e verificação visual (navegador real)

Executado com Playwright em **Chromium, Firefox e WebKit** (`@cross`) e axe-core (WCAG 2.0/2.1/2.2 A/AA). Capturas de tela em `e2e/.artifacts/screenshots/` (não versionadas; **dados fictícios**, sem dado pessoal).

## Resoluções × temas

| Resolução | Pipeline | Importação (arquivo → prévia → progresso → concluída) |
|---|---|---|
| Desktop 1920×1080 | claro ✔ escuro ✔ | claro ✔ escuro ✔ |
| Notebook 1366×768 | claro ✔ escuro ✔ | claro ✔ escuro ✔ |
| Tablet 768×1024 | claro ✔ escuro ✔ | claro ✔ escuro ✔ |
| Mobile 390×844 | claro ✔ escuro ✔ (WebKit: **achado A**) | claro ✔ escuro ✔ |

40 capturas (8 do Pipeline + 32 da importação) geradas pelo teste no Chromium; o diálogo de importação fica **contido na largura** da tela em todas as resoluções (assertado), com o botão final ("Ver no pipeline") visível sem rolar a página.

## Regras axe que falham o teste (controles da 1B)

`button-name`, `select-name`, `label`, `aria-dialog-name`, `aria-valid-attr(-value)`, `aria-required-attr`, `aria-allowed-attr`, `nested-interactive`, `duplicate-id-aria`, `aria-hidden-focus` e qualquer violação **crítica**: **0 violações** no Pipeline e nos 4 estados do diálogo de importação, nas 4 resoluções e 2 temas.

## Achados (axe e navegadores) — nenhum introduzido pela 1B

| # | Achado | Onde | Gravidade | Ação |
|---|---|---|---|---|
| **A** | **WebKit 390 px: a página rola 65 px na horizontal** — os campos de data do filtro de período (`dd/mm/aaaa`) têm largura intrínseca maior no WebKit/iOS. Chromium e Firefox: sem rolagem. | filtro de período do Pipeline | média (iPhone/Safari) | **registrado**, `test.fail` mantém o achado visível (vira erro quando for corrigido). Fora do escopo (redesign). |
| **B** | `color-contrast` (serious): botão **WhatsApp do cartão no tema claro** — 29 elementos no quadro | `WhatsappButton` (tema claro) | média | **registrado** (já listado como R5 da 1A); nenhum caso no tema escuro |
| C | Cabeçalhos "UF"/"Estado" não são reconhecidos no de/para (rótulo é "Estado (UF)") | importação | baixa | registrado |

## Teclado e foco (testes em navegador real)

- Tab percorre **cartão → seletor "mover" → WhatsApp**, com **foco visível** (contorno) em cada controle. **Defeito achado e corrigido:** o `select:focus` global zerava o contorno e o seletor "mover" — que só aparece *porque* o foco chegou ao cartão — mostrava apenas uma troca de cor de borda. Agora `.cardMove:focus-visible` tem contorno de 2 px.
- Enter no cartão abre o lead; Esc volta ao quadro.
- Diálogo de importação: **foco preso** (12 Tabs seguidos nunca saem do diálogo); Esc fecha antes de escolher arquivo e **devolve o foco ao botão de origem**; depois de escolher o arquivo, Esc **não** descarta; durante o processamento **nada fecha** (Esc, clique no fundo e ×) — só "Cancelar importação".
- Reordenar etapas por teclado preserva o foco no mesmo botão (E2E).
- Exclusão de lead exige confirmação; "Cancelar" mantém o lead e "Excluir" remove.

## Alvos de toque

- Desktop: botões de contato do cartão e de etapa ≥ **24 px** (WCAG 2.2 AA) — medidos com `boundingBox`.
- Emulação de celular (`hasTouch` + `isMobile`, `pointer: coarse`): controles do cartão e botões de etapa ≥ **44 px**; o seletor "mover" aparece **sem foco** (não há arrastar com o dedo) e **move o lead de fato**.

## Drag-and-drop

Arrastar o **card** entre etapas funciona em **Chromium, Firefox e WebKit** (teste `@cross`, com persistência no servidor conferida pela API). Arrastar o **cabeçalho da etapa** (reordenar) foi verificado no **Chromium**.

## Limitações (declaradas, não contornadas)

- **Leitor de tela (NVDA/VoiceOver): NÃO executado.** Os testes validam nomes, papéis e regiões vivas por atributos/árvore de acessibilidade — isso **não** substitui ouvir o anúncio. Pendente manual.
- Arrastar com **toque real** (iOS/Android) não é automatizável aqui; a alternativa por seletor é o caminho testado.
- Contraste foi medido pelo axe nos pontos renderizados; não há varredura de todas as telas do CRM (só Pipeline e importação).
