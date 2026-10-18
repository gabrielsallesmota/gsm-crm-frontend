# 04 — Componentes criados e alterados

Branch: `feat/gsm-crm-redesign-pipeline` (frontend). **Nada commitado** (como pedido). Backend: **nenhuma alteração** nesta fase (só o Gate Zero, já commitado — ver `01`).

## Criados

| Arquivo | Linhas | Papel |
|---|---|---|
| `components/pipeline/PipelineHeader.tsx` + `.module.css` | 113 + 161 | título, nome/seletor do pipeline, ajuda, **resumo com totais reais**, ações (Novo lead / Importar / Exportar) |
| `components/pipeline/PipelineFilters.tsx` + `.module.css` | 144 + 175 | busca, responsável, ordenação, **"Filtros" (disclosure)** com período "Criados em", chips ativos, "Limpar filtros" |
| `components/pipeline/KanbanColumn.tsx` + `.module.css` | 190 + 296 | cabeçalho (nome, soma exata, contador real, reordenar), corpo com rolagem, estados vazio/carregando/erro/destino do arraste |
| `components/pipeline/LeadCard.tsx` + `.module.css` | 165 + 206 | cartão (`React.memo`): nome, valor, empresa, comentário, origem, idade, responsável, ícones de contato, seletor "mover" |
| `components/pipeline/StageTabs.tsx` + `.module.css` | 43 + 55 | abas de etapa do celular (nome + total real) |
| `components/common/FilterChip.tsx` + `.module.css` | 33 + 59 | chip de filtro ativo removível |
| `components/common/Icons.tsx` | 106 | ícones SVG inline (decorativos) |
| `hooks/useMediaQuery.ts` | 29 | `useMediaQuery`, `useIsMobile`, `BREAKPOINTS` |
| `hooks/usePipelineDrag.ts` | 80 | estado do arrastar (cartão/coluna/destino) com callbacks estáveis; cancelar (`dragend`) limpa tudo; saída da coluna decidida pela posição do ponteiro |
| `hooks/useStageReorder.ts` | 75 | reordenar etapas (botões e arrastar) com foco devolvido ao botão certo |
| `utils/pipelineView.ts` | 138 | regras puras: `leadAge`, `describePeriod`, `filterChips`, `columnValue`, `boardSummary` (totais honestos) |

## Alterados

| Arquivo | O que mudou |
|---|---|
| `pages/PipelinePage.tsx` | **596 → 380 linhas**: deixou de conter a apresentação (cartão, coluna, cabeçalho e filtros → `components/pipeline/*`) e a lógica de arrastar/reordenar (→ `usePipelineDrag`, `useStageReorder`); mantém a orquestração (dados, mover, exportar, importar, composição). |
| `pages/PipelinePage.module.css` | **321 → 75 linhas**: só contêiner, quadro (`position: relative`) e seletor de origem (staff GSM) |
| `styles/theme.css` | tokens novos (`02`) |
| `components/leads/WhatsappButton.tsx` + `prospects/WhatsappButton.module.css` | variante `size="icon"`; texto na cor `--tone-wa-text` (**contraste corrigido**; vale também para a Prospecção, que compartilha o CSS) |
| `components/leads/EmailButton.tsx` + `.module.css` | variante `size="icon"` |
| `components/common/PeriodFilter.module.css` | campos de data com `min-width: 0` e quebra de linha (overflow do WebKit) |
| `layouts/AppLayout.module.css` | menu lateral fechado (≤ 900 px): sem vazamento de sombra e fora da ordem de Tab |

## Removidos
`KanbanCard` (função interna do `PipelinePage`) e ~250 linhas de CSS de cabeçalho/coluna/cartão antigas (substituídas pelos módulos acima). Nada de código morto restante: ícone não usado removido (`IconGrip`); nenhum import órfão (eslint/tsc limpos).

## Contratos preservados

- `usePipelineBoard`, `LeadsApiRepository`, `usePipelines`, `useLeadActions`: **intactos**. Mesmos parâmetros de listagem (`search`, `owner_id`/`unassigned`, `date_from`/`date_to`, `sort_by`/`sort_dir`, `stage_id`, `page`).
- Mesmos nomes acessíveis usados por testes e leitores: "Abrir <nome>", "Mover <nome> para outra etapa", "Mover etapa <X> para a esquerda/direita", "Buscar lead", "Responsável", "Ordenação", "Pipeline", "Carregar mais (N)", "Importar planilha", "Exportar CSV", `title="Total real nesta etapa"`.
- Contatos: o link de WhatsApp/e-mail passou de texto ("💬 WhatsApp") para ícone com `aria-label` ("Abrir WhatsApp de <nome>", "Escrever e-mail para <nome>").
- Seletores de teste: classes de CSS Module → **atributos `data-*`** (`data-stage-column`, `data-stage-name`, `data-stage-count`, `data-stage-header`, `data-stage-move`, `data-lead-id`).
