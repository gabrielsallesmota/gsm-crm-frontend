# 07 — Performance

Princípio: não degradar o que já existia (paginação, ordenação global, cache, atualização otimista, rollback) e não complicar sem prova.

## O que foi preservado (intocado)

`usePipelineBoard` (uma consulta por etapa, 25/página, geração para descartar respostas antigas), `LeadsApiRepository`, cache de leituras, movimento otimista com rollback, `Idempotency`/importação. **O redesign não faz nenhuma consulta nova**: mesmos parâmetros, mesmo número de requisições por mudança de filtro (uma por etapa).

## Medidas aplicadas (e a prova de cada uma)

| Medida | Por quê | Prova |
|---|---|---|
| `React.memo` em `LeadCard` + callbacks **estáveis** (`useCallback` + ref nos hooks `usePipelineDrag`/`useStageReorder`) | durante um arraste o destino realçado muda a cada `dragenter`; sem `memo`, **todos** os cartões (25–130+) seriam redesenhados | teste `pipelineRedesign`: 12 cartões, 3 realces de destino → **0 redesenhos de cartão** (conta chamadas de `leadAge`, que roda em cada render) |
| `setState` idempotente em `dragover` | `dragover` dispara dezenas de vezes por segundo; repetir o mesmo valor não re-renderiza | mesmo teste + E2E de arraste real |
| Rolagem própria da coluna (`max-height` + `overflow-y`) | cabeçalho e controles sempre à vista, sem o navegador pintar a página inteira ao rolar | E2E: coluna com 25+ cartões tem rolagem vertical própria |
| **Só a coluna ativa no DOM no celular** | 1 coluna em vez de N: menos nós e árvore de acessibilidade mais curta | teste: 1 `[data-stage-column]` em 390 px |
| Ícones SVG inline, sem biblioteca | sem custo de rede/JS extra | build: +13,5 kB no JS principal (+3,5 %) por **todo** o código novo |
| Esqueleto por CSS (sem JS de animação) | `animation` de opacidade, desligada em `prefers-reduced-motion` | — |
| Resumo/soma calculados a partir de `board` já em memória (`boardSummary`, `columnValue`: O(colunas × itens carregados)) | sem requisição nova; soma só com coluna inteira | testes Node (11) |

## Medidas NÃO tomadas (sem justificativa medida)

- **Virtualização** de listas: com 25 cartões por página por coluna e "Carregar mais", o E2E com **130 leads** no quadro ordenou/filtrou em **< 3 s** (assert no teste) sem travar; virtualizar adicionaria complexidade e quebraria o arraste nativo.
- `useMemo` em massa / bibliotecas de estado: nenhum gargalo medido.
- `memo` em `KanbanColumn`: re-renderiza só quando o estado do quadro muda (necessário); o ganho está nos cartões.

## Riscos

- O tema ainda não foi perfilado com o **React Profiler** em hardware fraco; a evidência é por contagem de renders (teste) e tempo de resposta (E2E), não por flame graph.
- A atualização de contadores/valores a cada `Carregar mais` recalcula somas de coluna (barato; ≤ centenas de itens).
