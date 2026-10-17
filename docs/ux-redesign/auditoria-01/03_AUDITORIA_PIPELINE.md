# 03 — Auditoria do Pipeline

Arquivos: `src/pages/PipelinePage.tsx`, `PipelinePage.module.css`, `hooks/usePipelineBoard.ts`, `utils/boardSort.ts`, `utils/pipelineBoard.ts`, `components/common/PeriodFilter.tsx`. Backend: `leads/adapters/inbound/router.py`.

Formato de cada achado: **ID · severidade · tipo** — descrição — evidência — impacto — recomendação — risco técnico — backend?

## Achados

**PIP-01 · P1 · [C]** Card com `role="button"` contém controles interativos.
Evidência: `PipelinePage.tsx:478-529` — o `div` do card é `role="button"`/`tabIndex=0` e dentro dele há um `<select>` (511-527), dois links/botões (WhatsApp, e-mail). Interativo aninhado em botão é falha de semântica (leitores de tela anunciam o card como um botão sem expor os filhos de forma confiável).
Impacto: usuários de leitor de tela e de teclado têm foco/anúncio confuso. Recomendação: card como `<article>` com um botão/link "Abrir lead" no nome e ações irmãs. Risco: médio (muda estrutura e CSS; testes de clique). Backend: não.

**PIP-02 · P1 · [C]** Ordenação só atua sobre o que já foi carregado.
Evidência: `sortBoardItems` roda sobre `column.items` (`PipelinePage.tsx:366-372`); cada coluna carrega 25 (`BOARD_PAGE_SIZE`, `pipelineBoard.ts:23`). O comentário de `boardSort.ts:1-6` ainda diz "página inteira (200 itens)". "Nome Z-A" mostra o Z dos 25 carregados, não o Z da coluna.
Impacto: resultado enganoso em colunas grandes. Recomendação: usar o `sortBy`/`sortDir` que a API já aceita (`name`, `created_at`, `updated_at`, `expected_value`, `probability`, `last_interaction_at` — `repository.py:36-43`; `LeadListFilter.sortBy`, `types/lead.ts:98-99`). Risco: baixo. Backend: não.

**PIP-03 · P1 · [C]+[H]** O card não mostra o que exige atenção.
Evidência: `KanbanCard` exibe nome, empresa, último comentário, valor, origem, responsável (496-509). A API de listagem já devolve `next_cadence_step` (`router.py:165-174`), mas o frontend não o consome (nenhuma ocorrência em `src/`). Atividades atrasadas, próxima atividade e tempo na etapa não existem no payload (ver 07).
Impacto: o vendedor precisa abrir cada lead para saber o que fazer — o ganho principal do "Pipedrive" (sinais de atenção) está ausente. Recomendação: fase 1 com `next_cadence_step`; fase 2 com campos agregados (07). Risco: baixo (fase 1), médio (fase 2). Backend: fase 2 sim.

**PIP-04 · P2 · [C]** Reordenar colunas só por arrastar no quadro.
Evidência: `PipelinePage.tsx:380-385` (`draggable` no cabeçalho, `title` como única dica). Sem alternativa por teclado no quadro; existe nas Configurações (setas, `SettingsPage.tsx:464-478`). Mitigação parcial. Recomendação: manter a função só em Configurações no redesign ou adicionar menu de coluna com "Mover para a esquerda/direita". Risco: baixo.

**PIP-05 · P2 · [C]** Alternativa de teclado para mover etapa fica escondida no desktop.
Evidência: `.cardMove { display: none }` em `(hover: hover) and (pointer: fine) and (min-width: 761px)` (`PipelinePage.module.css:212-216`). Quem usa teclado em desktop só move abrindo o lead (Enter) e usando o select do painel. Funciona, mas custa 3 passos. Recomendação: menu "Mover para…" por card acessível por teclado (botão que abre lista), visível ao foco. Risco: baixo.

**PIP-06 · P2 · [C]** Filtros e seleção não persistem.
Evidência: busca, responsável, ordenação, período e pipeline selecionado são `useState` (`PipelinePage.tsx:55-56, 123, 130-133, 158`). Recarregar ou voltar do lead perde o contexto. Recomendação: sincronizar com a URL (`?pipeline=&q=&dono=&de=&ate=`), mantendo `?importar=1`. Risco: baixo-médio (deep links, testes).

**PIP-07 · P2 · [C]** "Período" filtra por data de criação e os presets ficam velhos.
Evidência: o backend aplica `created_from/created_to` (`repository.py:229-233`) — "Hoje/7 dias/Este mês" significam "leads **criados** nesse período", sem rótulo que diga isso. `PRESETS` é constante de módulo que chama `todayPeriod()` uma vez (`PeriodFilter.tsx:13-20`): numa aba aberta após a meia-noite, "Hoje" aponta para o dia anterior. [V] confirmar com usuários se esperam "movimentados" em vez de "criados". Risco: baixo.

**PIP-08 · P2 · [P]** Barra de ferramentas sobrecarregada e cabeçalho sem quebra de linha.
Evidência: seis controles no mesmo nível (`PipelinePage.tsx:295-347`: pipeline, busca, responsável, ordenação, Importar, Exportar). `.header` é `display:flex; justify-content:space-between` sem `flex-wrap` nem `@media` (`.module.css:46-51`); a captura em modo demo a 1440 px mostra a barra descendo para a segunda linha. Em larguras estreitas o título e a barra competem. [P] verificar em 360–768 px. Recomendação: busca e filtros principais visíveis; ordenação, exportar/importar em menu "Mais" (progressive disclosure). Risco: baixo.

**PIP-09 · P2 · [D]** Ganho/Perdido sem confirmação nem motivo.
Evidência: `moveLead` (162-172) e `handleMove` do painel (`LeadDrawer.tsx:94-113`) movem direto; toast de "ganho/perdido". O backend não recebe motivo de perda. Decisão de produto: exigir motivo de perda e/ou confirmação? Se sim, há mudança de contrato (07).

**PIP-10 · P2 · [C]** Cada filtro recarrega todas as colunas.
Evidência: `usePipelineBoard.ts:95-100` zera o quadro e dispara uma requisição por etapa; com 6 etapas são 6 chamadas a cada mudança de busca/filtro (a busca tem debounce de 300 ms, `PipelinePage.tsx:131`). Causa flicker ("Carregando…" em todas as colunas) e carga no backend. Recomendação: manter dados antigos até a resposta nova chegar (stale-while-revalidate) e cancelar requisições antigas (`AbortController`). Risco: médio.

**PIP-11 · P2 · [P]** Arrastar usa a API HTML5 nativa.
Evidência: `draggable` + `onDragStart/onDrop` (374-385, 478-482). Em celular/tablet o arrastar nativo não funciona; mitigado pelo select visível em telas de toque. Sem indicação visual do destino. Recomendação: realce da coluna-alvo e do ponto de inserção; manter o select/menu como alternativa. Não adotar biblioteca nova sem decisão. Risco: baixo.

**PIP-12 · P2 · [C estimado]** Alvos pequenos nos botões do card.
Evidência: `.btnSmall { padding: 4px 9px; font-size: 11px }` (`prospects/WhatsappButton.module.css:25-28`) → altura ≈ 22 px (< 24 px do WCAG 2.2 AA 2.5.8). Validar com medição no navegador.

**PIP-13 · P2 · [O]** Sem total de valor por coluna.
Evidência: o contador mostra só `column.total` (`:391-393`). Somatório exige novo campo de backend (07). Impacto: o Pipedrive-like precisa de "R$ por etapa" para priorizar. Backend: sim (opcional).

**PIP-14 · P2 · [H][V]** Identificação do pipeline e objetivo da tela.
Evidência: o seletor só aparece com mais de um pipeline (`:296`); com um, o título é só "Pipeline". O subtítulo ("Arraste os cards…") é instrução, não contexto. Recomendação: mostrar o nome do pipeline e totais (leads, valor) no cabeçalho. Validar com usuários.

**PIP-15 · P3 · [C calculado]** Texto "Sem leads" abaixo de 4,5:1.
Evidência: `.empty { color: var(--faint); font-size: 12px }` (`:181-186`); `--faint` = `#5f6b76` sobre `--card-bg-alt` ≈ **3,46:1** (tema escuro) e `#8d98a3` sobre branco ≈ **2,94:1** (tema claro). Recomendação: usar `--muted-2` (≥ 5:1 no escuro; 4,84:1 no claro).

**PIP-16 · P3 · [H]** Tipografia pequena no card (`.cardComment` 11 px, `.cardOwner` 11,5 px). Avaliar com usuários e zoom.

**PIP-17 · P3 · [P]** Busca sem escape de curinga e sem normalização de telefone.
Evidência: `LeadModel.phone.ilike('%termo%')` (`repository.py:216-225`) — `%` e `_` digitados atuam como curingas; telefone digitado "11 98765" não casa com `(11) 98765-…`. Backend: sim (menor).

## Respostas às 15 perguntas

1. **Objetivo imediato?** Sim, pelo título e pelo quadro; o subtítulo é instrucional.
2. **Pipeline selecionado?** Só com mais de um pipeline (PIP-14).
3. **Onde criar lead?** Botão "+ Lead" na barra superior e estado vazio; não há "+ Adicionar" por coluna.
4. **Encontrar oportunidade?** Busca por nome, empresa, e-mail e telefone no servidor (PIP-17); sem filtro por etapa/valor/tag no quadro.
5. **Leads que precisam de atenção?** Não (PIP-03).
6. **Significado das informações do card?** Sem rótulos: "R$ 1.800", etiqueta de origem, nome do dono; razoável, mas sem legenda para o ícone 💬.
7. **Mover sem arrastar?** Sim: select (toque) ou painel do lead (PIP-05).
8. **Filtros intuitivos?** Período e busca sim; "Ordenar" é enganoso (PIP-02); "Período" é por criação (PIP-07).
9. **Excesso de controles?** Sim, moderado (PIP-08).
10. **Muitas etapas?** Scroll horizontal com colunas de 240 px mínimas (`.board`, `.module.css:86-93`); sem cabeçalho fixo nem atalho de navegação. [V]
11. **Telas menores?** Parcial: select de mover aparece, cabeçalho pode quebrar (PIP-08). [P]
12. **Ações escondidas?** Reordenar colunas (arrastar o cabeçalho), importar/exportar, mover por teclado.
13. **Erros sem orientação?** Erros de coluna têm "Tentar de novo"; erro de exportação vira toast; importação mostra uma linha vermelha.
14. **Feedback após ações?** Sim: toasts, estado `pending`, rollback. Falta indicar sucesso de importação no quadro além do resumo.
15. **Funcionalidade importante de acesso difícil?** Registrar contato e próxima ação — só no painel.

## Hierarquia visual proposta (sem remover funcionalidades)

1. **Faixa de contexto**: nome do pipeline (seletor), totais (leads, valor), busca; botão primário "+ Lead".
2. **Filtros**: responsável e período à vista; ordenar, importar, exportar e "limpar filtros" num menu "Mais".
3. **Colunas**: cabeçalho com nome, contagem, valor total (fase 2); menu "⋯" por coluna (mover coluna, ver só esta etapa).
4. **Card (3 linhas)**: nome + empresa; valor + origem; **faixa de status** (atrasado / próxima ação / parado há N dias) + avatar do responsável. Ações de contato visíveis ao foco/hover e sempre no painel.
5. **Rodapé de coluna**: "+ Adicionar lead" e "Carregar mais".
