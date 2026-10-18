# 04 — Lead perdido (D-03): confirmação em todos os caminhos

**Decisão aprovada (D-03):** marcar um lead como perdido exige confirmação; o motivo da perda **continua opcional** (e **não** foi introduzido).

## Mapeamento das entradas (inspeção do código, não só da documentação)

| Caminho que pode levar um lead a "perdido" | Onde passa | Antes (Prompt 07) | Agora |
|---|---|---|---|
| Painel do lead › seletor "Etapa" | `LeadDrawer.requestMove` | confirmava | confirma (mesma regra e mesmo diálogo) |
| Quadro › **arrastar** o cartão para a coluna da etapa | `usePipelineDrag.drop → moveLead` | **não confirmava** | confirma |
| Quadro › seletor **"Mover … para outra etapa"** do cartão (celular/teclado) | `usePipelineDrag.moveLeadToStage → moveLead` | **não confirmava** | confirma |
| Quadro › abas de etapa no celular | só filtram a coluna visível; mover é o seletor acima | n/a | coberto pelo seletor |
| Ações em lote (mover vários leads) | **não existem** para leads (só a Prospecção tem `BulkMoveStageModal`, outro módulo) | n/a | n/a |
| Página Leads (lista) | abre o painel; não move | n/a | coberto pelo painel |
| Importação CSV | cria leads na etapa de entrada (nunca perdida); a etapa de entrada é escolhida entre as etapas do pipeline, o assistente não a restringe, porém **cria**, não "marca como perdido" | n/a | fora do escopo da regra |
| API pública/integrações | endpoint próprio (`/public/...`); a confirmação é de **UX**, não de segurança | n/a | n/a (backend autoriza) |

> Os dois caminhos do quadro convergem em **um único ponto** (`PipelinePage.moveLead`), e o painel usa a **mesma** regra e o mesmo componente. Não há segunda cópia da lógica.

## Arquitetura

- `utils/pipelineBoard.ts › needsLostConfirmation(from, to)`: **pura**, testada em Node. Pede confirmação quando `to.isLost` e o lead **não** estava numa etapa perdida (mover entre duas perdidas ou para a mesma não é uma nova perda).
- `components/leads/ConfirmLostDialog.tsx`: **uma única** fonte do diálogo e do texto ("Marcar como perdido?", citando lead e etapa).
- `PipelinePage.moveLead` intercepta **antes** de `board.move`: nem a movimentação otimista acontece até confirmar. Ao confirmar chama `performMove` (otimista + rollback como já era).
- Sem motivo obrigatório; sem diálogo para ganho ou movimentos normais; sem confirmações duplas (painel aberto no quadro pergunta **uma** vez).

## Comportamento

1. Intercepta antes da persistência. 2. Mostra `"<lead>" será movido para "<etapa>" e contado como negócio perdido…`. 3. Cancelar (botão ou Esc): o lead permanece na etapa de origem, nada é gravado, seletor volta ao valor original. 4. Confirmar: movimento otimista → API → toast "Negócio marcado como perdido". 5. Erro depois de confirmar: **rollback** para a etapa de origem + toast de erro.

## Testes

| Caminho | Vitest (`pipelinePage.spec.tsx`) | Playwright (`settings.spec.ts`, API real) |
|---|---|---|
| Seletor "mover": confirma antes; nada otimista/gravado; confirmar grava e avisa | ✅ | ✅ (verifica o estado no servidor antes e depois) |
| Cancelar preserva o estado anterior | ✅ | ✅ |
| Arrastar para Perdido confirma antes | ✅ (eventos sintéticos) | ✅ (arraste **real** do navegador, 1920 px para a coluna ficar à vista) |
| Painel: uma única confirmação; ganho não pergunta | ✅ | ✅ |
| Erro do servidor após confirmar: rollback e aviso | ✅ | ✅ (`route.fulfill` 500 em `/leads/*/move`) |
| Movimento normal (Novo → Em contato) não pergunta | ✅ | ✅ |
| Regra pura (`needsLostConfirmation`) | Node: entra/sai/entre perdidas/mesma/indefinida | — |

Acessibilidade do diálogo: `role="dialog"` nomeado, foco preso e devolvido, Esc cancela — **axe 0 violações** nas 8 combinações (4 resoluções × 2 temas); o botão "Marcar como perdido" teve o contraste corrigido no tema claro (ver `02`).

## Limite conhecido

A confirmação é de **UX**: não substitui a autorização do backend. Quem chama a API diretamente move sem diálogo (como sempre foi).
