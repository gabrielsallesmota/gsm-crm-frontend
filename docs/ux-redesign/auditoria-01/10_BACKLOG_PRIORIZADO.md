# 10 — Backlog priorizado

Prioridades: **P0** crítico · **P1** importante · **P2** relevante · **P3** refinamento. Complexidade: B/M/A. Risco: risco de regressão. Impacto: no usuário. "Ordem" = sequência recomendada (ver fases em 12).
Não há P0 confirmado. Nenhum item é preferência estética classificada acima de P3 sem evidência.

## Tabela de achados (53)

| ID | Resumo | Tipo | Prio | Impacto | Compl. | Risco | Backend |
|---|---|---|---|---|---|---|---|
| PIP-01 | Controles dentro de `role="button"` no card | [C] | P1 | Alto (a11y) | M | M | Não |
| PIP-02 | Ordenação só sobre itens carregados | [C] | P1 | Alto | B | B | Não |
| PIP-03 | Card sem sinais de atenção | [C][H] | P1 | Muito alto | B→M | B→M | Fase 2: B-1 |
| PIP-04 | Reordenar coluna só por arrastar | [C] | P2 | Médio | B | B | Não |
| PIP-05 | Mover por teclado oculto no desktop | [C] | P2 | Médio | B | B | Não |
| PIP-06 | Filtros não persistem | [C] | P2 | Médio | B | B | Não |
| PIP-07 | Período por criação; presets velhos | [C][V] | P2 | Médio | B | B | Não |
| PIP-08 | Barra sobrecarregada; header sem wrap | [P] | P2 | Médio | B | B | Não |
| PIP-09 | Ganho/Perdido sem confirmação/motivo | [D] | P2 | Médio | M | A | B-3 cond. |
| PIP-10 | Recarrega todas as colunas a cada filtro | [C] | P2 | Médio | M | M | Não |
| PIP-11 | DnD nativo sem indicador de destino | [P] | P2 | Médio | M | M | Não |
| PIP-12 | Alvos pequenos (≈ 22 px) | [C est.] | P2 | Médio | B | B | Não |
| PIP-13 | Sem total de valor por coluna | [O] | P2 | Médio | M | B | B-2 |
| PIP-14 | Identificação do pipeline/objetivo | [H][V] | P2 | Baixo-médio | B | B | Não |
| PIP-15 | "Sem leads" com contraste 3,3:1 | [C] | P3 | Baixo | B | B | Não |
| PIP-16 | Fonte 11 px no card | [H] | P3 | Baixo | B | B | Não |
| PIP-17 | Busca: curinga e telefone normalizado | [P] | P3 | Baixo | B | B | B-4 |
| DRW-01 | Campos sem rótulo | [C] | P1 | Alto (a11y) | B | B | Não |
| DRW-02 | Sem resumo de contexto no topo | [H][V] | P1 | Muito alto | M | M | B-1 |
| DRW-03 | Salvamento misto | [C][D] | P2 | Médio | B | M | Não |
| DRW-04 | Validação mínima | [C] | P2 | Médio | B | B | Confirmar regras |
| DRW-05 | Timeline cortada em 100 | [C] | P2 | Médio | B | B | B-6 opc. |
| DRW-06 | Interação = só comentário | [D] | P2 | Alto | A | M | B-5 |
| DRW-07 | Vendedor exclui os próprios leads | [D] | P2 | Médio | — | — | Decisão |
| DRW-08 | Sem URL do lead no Pipeline | [C] | P2 | Médio | B | B | Não |
| DRW-09 | Botão fechar pequeno | [P] | P3 | Baixo | B | B | Não |
| DRW-10 | Tarefas: só criar/concluir | [C] | P3 | Baixo | M | B | Não |
| IMP-01 | Modal sem padrão de diálogo; fecha ao clicar fora | [C] | P1 | Alto | B | M | Não |
| IMP-02 | > 2.000 linhas falha o lote | [C] | P1 | Alto | B | B | Não |
| IMP-03 | Descartes silenciosos | [C] | P1 | Alto | M | B | Não |
| IMP-04 | Sem pré-visualização/validação | [C] | P1 | Alto | M | B | Não |
| IMP-05 | Mapeamento inconsistente não avisado | [C] | P2 | Médio | B | B | Não |
| IMP-06 | Selects sem rótulo | [C] | P2 | Médio | B | B | Não |
| IMP-07 | Motivos de "ignorado" invisíveis | [C] | P2 | Médio | B | B | Não |
| IMP-08 | Dedupe só por telefone; "atualizar" parcial | [C] | P2 | Médio | B (texto) | B | Não |
| IMP-09 | Campos do backend não expostos | [O][D] | P2 | Médio | M | B | Não |
| IMP-10 | Processamento na thread principal | [H] | P3 | Baixo | M | B | Não |
| CFG-01 | Página monolítica; públicos misturados | [C] | P1 | Alto | M | M | Não |
| CFG-02 | Exclusão de tag/template sem confirmar | [C] | P1 | Alto | B | B | Não |
| CFG-03 | Excluir etapa apaga templates sem aviso | [C] | P2 | Médio | B | B | Não |
| CFG-04 | Origens estáticas × `/lead-sources` | [D] | P2 | Médio | A | M | Não (pronto) |
| CFG-05 | Criar etapa sem ganho/perdido | [C] | P2 | Médio | B | B | Não |
| CFG-06 | Campos sem rótulo | [C] | P2 | Médio | B | B | Não |
| CFG-07 | Template: sem rótulo/prévia/validação | [C] | P2 | Médio | M | B | Não |
| CFG-08 | Comentário desatualizado de permissão | [C] | P3 | Baixo | B | B | Não |
| CFG-09 | Reordenar etapas pouco descobrível | [H] | P2 | Baixo-médio | B | B | Não |
| SYS-01 | Sem testes de componente nas 4 telas | [C] | P2 | Alto (risco) | M | — | Não |
| SYS-02 | Contraste do acento em texto no tema claro (3,22:1) | [P] | P2 | Médio | B | B | Não |
| SYS-03 | `--faint` em texto (drawer) | [C] | P3 | Baixo | B | B | Não |
| BE-01 | `last_interaction_at` só muda ao mover | [C] | P2 | Médio | — | — | Definição D-01 |
| BE-02 | Sem backfill de eventos pré-0054 | [C] | P2 | Médio | M | B | Opcional |
| BE-03 | Busca sem índice trigram | [H] | P3 | Baixo | M | B | Opcional |
| BE-04 | Comentários/premissas desatualizados | [C] | P3 | Baixo | B | B | Não |
| _ref._ | `aria-live`/`role="alert"` em resultados e erros (A-09/A-10 do doc 08) | [C] | — | Médio | B | B | Não |

Totais: **P0 0 · P1 11 · P2 32 · P3 10 = 53**. A linha _ref._ é referência cruzada ao doc 08 (já contabilizada em IMP-04/IMP-07/PIP) e não entra na soma.

## Melhorias de maior impacto (ordem recomendada)

| # | Melhoria | Achados | Impacto | Compl. | Risco | Dependências |
|---|---|---|---|---|---|---|
| 1 | Importação: limite por lote, relatório de pré-importação, motivos de ignorados, `Modal` compartilhado | IMP-01..04, 07 | Evita falhas e perdas silenciosas | M | B | testes de componente |
| 2 | Rótulos programáticos em todos os formulários do escopo | DRW-01, IMP-06, CFG-06/07 | A11y + usabilidade | B | B | — |
| 3 | Confirmação de exclusões e aviso de cascata | CFG-02, CFG-03 | Evita perda de dados | B | B | — |
| 4 | Card do Pipeline: faixa de status (fase 1: cadência; fase 2: agregados) | PIP-03, 13 | Eficiência comercial | B→M | B→M | B-1 (fase 2) |
| 5 | Ordenação no servidor | PIP-02 | Corrige resultado enganoso | B | B | — |
| 6 | Cabeçalho de contexto do lead + ação de contato | DRW-02, 06, 10 | Fluxo "abrir → contatar → registrar → próxima ação" | M | M | indicadores B-1; D-05 |
| 7 | Card acessível (sem interativo aninhado) + menu "Mover para…" | PIP-01, 04, 05 | A11y | M | M | testes do quadro |
| 8 | Configurações em sub-rotas | CFG-01, 09 | Descoberta | M | M | guardas e links existentes |
| 9 | Filtros na URL + período correto + barra reorganizada | PIP-06..08, 14 | Contexto preservado | B | B | D-02 |
| 10 | Assistente de importação em 4 passos | IMP-04, 05, 08, 09 | Confiança no fluxo | M | B | item 1 |

## Dependências entre itens

- Testes de componente (SYS-01) **antes** de PIP-01, DRW-*, IMP-*, CFG-01.
- Rótulos (item 2) podem ir isolados, sem esperar o redesign visual.
- Indicadores (B-1) dependem da definição D-01 (última interação) e D-02 (período).
- Menu "Mais" e filtros na URL andam juntos para não duplicar estado.
