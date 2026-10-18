# 03 — Redesign do Pipeline (decisões visuais e funcionais)

Objetivo da tela: o vendedor entende **onde estão** as oportunidades, **o que precisa de atenção**, **o que fazer** e **como mover** uma negociação — sem aprender a interface. Nenhuma função foi removida (matriz em `08_TESTES_REGRESSAO.md`).

## Antes → depois

| Área | Antes | Depois |
|---|---|---|
| Cabeçalho | título + frase de ajuda + 6 controles soltos (pipeline, busca, responsável, ordenação, importar, exportar) numa linha | **título + nome do pipeline + ajuda (?)**, **resumo** com totais reais, **ação primária "Novo lead"** e Importar/Exportar como secundárias |
| Totais | nenhum (PIP-13/14) | "**24 oportunidades · 19 em andamento (R$ 58.800)**" — contagens = `total` real do servidor; valor só quando exato |
| Filtros | período (presets + 2 datas) sempre aberto no topo, sem rótulo de regra | **busca + responsável + ordenação** à vista; **"Filtros"** (disclosure, `aria-expanded`) guarda o período, rotulado **"Criados em"**; filtros ativos viram **chips removíveis** e "Limpar filtros" |
| Coluna | cabeçalho com nome/contador; rolagem só da página | nome, **soma de valores (se exata)**, contador real, reordenar (revelado por foco/hover; sempre visível em toque); **rolagem própria** da coluna; destino do arraste realçado |
| Cartão | nome, empresa, comentário, valor sempre ("R$ 0"), origem, dono, 2 botões com texto | **nome em destaque**, valor só se > 0, empresa/comentário discretos, origem + **idade** (desde a criação), rodapé com **responsável (avatar)** e **ícones** de WhatsApp/e-mail; "Sem responsável" como atenção |
| Estados | texto "Carregando…", "Sem leads" | **esqueletos**, vazio com dica, erro com "Tentar de novo", "Movendo…", arrastando, soltar aqui |
| Celular | colunas espremidas/rolagem lateral; página rolava ~65 px no WebKit | **uma etapa por vez** com abas (nome + total real); sem overflow |

## Decisões

**1. Totais honestos (PIP-13 / D-09).** O backend devolve o `total` por etapa mas **não a soma dos valores**. Por isso: contagens vêm do servidor; **valores em R$ só aparecem quando todos os leads da etapa estão carregados** (`items.length === total`). Coluna com "Carregar mais" não mostra soma, e o resumo não mostra valor se alguma etapa em andamento está parcial. Nunca se apresenta soma de página parcial como total (teste: `boardSummary`/`columnValue`). O campo agregado do servidor (B-2) segue como pendência opcional (`10`).

**2. "Criados em" (D-02).** A regra continua sendo a **data de criação** do lead; a mudança é só dizê-lo ("Criados em: Hoje"). Nenhum parâmetro de API mudou.

**3. Sinais de atenção.** Só entra o que tem dado confiável hoje: **"Sem responsável"** (texto + borda âmbar). Não foram criados indicadores de "última interação" (D-01 não decidida; `last_interaction_at` só muda ao mover). A **idade** exibida é desde a **criação** (rotulada "Criado há …" no tooltip/leitor de tela) para não ser confundida com atividade.

**4. Ações sem hover.** WhatsApp e e-mail são sempre visíveis (ícones com nome); mover = arrastar **ou** seletor (revelado por foco de teclado, sempre visível em toque) **ou** abrir o lead. O que depende de hover/foco é só reordenar etapas (PIP-04), que tem alternativa em Configurações e fica sempre visível em toque.

**5. Sem menus novos.** Considerado um menu "⋯"/"Mover para…" por cartão; mantido o `<select>` nativo (acessível por teclado e leitor de tela, já testado, zero JS de posicionamento). Revisitar só se a pesquisa com usuários pedir.

**6. Drag-and-drop preservado.** Mesma API HTML5 (sem biblioteca nova). Acrescentado: `dataTransfer` (Firefox só inicia arraste com dado), `onDragEnd` (arraste **cancelado** agora limpa o estado — antes um drop posterior podia mover o lead antigo), realce de destino e do cartão arrastado.

**7. Mobile = uma etapa por vez.** Espremer N colunas num telefone não funciona. As abas mostram etapa + total real e só a coluna ativa vai ao DOM (menos nós, sem conteúdo invisível na árvore de acessibilidade). Tudo o que existe no desktop existe no celular (testado).

**8. Rolagem.** O quadro rola na horizontal **dentro dele** (`overflow-x:auto` + `position:relative`); a coluna rola na vertical com o cabeçalho sempre à vista; a **página nunca** ganha barra lateral (assertado em 3 navegadores e 4 resoluções).

## Fora do escopo (conforme o prompt)

Drawer do lead, assistente de importação CSV e Configurações (Prompts 07/08) — **não alterados**. Não foram criadas métricas, interações, automações, origens, permissões nem alterações de backend/banco no redesign.
