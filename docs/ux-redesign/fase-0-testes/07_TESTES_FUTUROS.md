# 07 — Testes futuros (planejados, **não** implementados)

Cada cenário abaixo existe hoje como `it.todo` (frontend, `tests/ui/plannedFuturePhases.spec.tsx`) ou `skip` com motivo "PLANEJADO" (backend, `tests/integration/test_planned_future_phases.py`). Eles aparecem como **pendentes**, nunca como verdes. Ao implementar a fase, remover o `todo`/`skip` e escrever o corpo.

## D-10 — Importação em lotes (até 10.000 linhas, lotes de até 500, com progresso)

Hoje: a tela envia **todas** as linhas numa chamada; o servidor aceita no máximo 2.000 (2.001 e 10.000 → 422 do lote inteiro, nada gravado — testes de caracterização já existem e **devem ser alterados** quando D-10 entrar).

| # | Cenário | Camada | Observação |
|---|---|---|---|
| 1 | 10.000 linhas viram 20 requisições de ≤ 500, em ordem | front | contar chamadas e tamanhos |
| 2 | Progresso reflete lotes concluídos/total; Cancelar interrompe após o lote atual | front | `deferred()` por lote |
| 3 | **Falha parcial**: lotes confirmados permanecem; relatório lista as linhas do lote que falhou e permite reenviar só elas | front + back | decidir se há transação por lote (hoje cada requisição é uma transação) |
| 4 | **Reprocessamento/idempotência**: reenviar o mesmo arquivo com "ignorar duplicados" não cria repetidos; com "duplicar" a tela avisa | front + back | já há base em `test_duplicate_inside_the_same_file…` |
| 5 | **Duplicado entre lotes** segue a estratégia (o lote 2 enxerga o lote 1) | back | como o dedupe é por telefone e sequencial, deve passar; **testar com duas requisições simultâneas** (lacuna atual: sem índice único) |
| 6 | **Cancelamento**: não deixa lote "meio gravado"; relatório final preserva o que foi feito | front + back | |
| 7 | **Relatório final**: criados/atualizados/ignorados **com motivo**/erros por linha; baixar CSV de erros | front | motivos de ignorados hoje não são exibidos (IMP-07) |
| 8 | Auditoria/limites: um evento por lote, escopo de tenant, taxa limitada | back | |
| 9 | Fechar o assistente durante o processamento pede confirmação | front | hoje o fundo fecha sem aviso (IMP-01) |

## D-01 — Última interação (comentário, tarefa concluída, atividade integrada, movimentação; edição cadastral **não** conta)

| # | Cenário | Observação |
|---|---|---|
| 1 | Cada um dos quatro eventos atualiza a "última interação" | o teste atual `…only_changes_when_the_lead_is_moved_today` **vira o oposto** (os asserts `is None` mudam) |
| 2 | Edição cadastral (PATCH) e import-update **não** alteram | já é verdade para PATCH; confirmar para import |
| 3 | Lead sem histórico (anterior à migration 0054) não gera erro e usa o fallback combinado (D-13) | |
| 4 | O valor aparece no card/painel e na ordenação por `last_interaction_at` | |

## D-03 — Lead perdido

| # | Cenário |
|---|---|
| 1 | Mover para etapa `isLost` abre confirmação (card, seletor e painel); **cancelar** mantém a etapa; **confirmar** move |
| 2 | Motivo opcional: enviado quando preenchido; ausência não bloqueia; vai para o evento `lost` da timeline |
| 3 | Toast e efeitos (webhook `lead.lost`, conversão no dashboard) permanecem **iguais** — comparar com `test_lost_lead_records_event_emits_webhook…` |

## D-05 — Tipos de interação (após o redesign do painel)

Registrar ligação/WhatsApp/e-mail/reunião com autor e data; aparecer na timeline com ícone; contar para a "última interação" (D-01); permissões iguais às do comentário; auditoria.

## Redesign (D-02, D-07, D-08, D-09, D-12, D-13)

| Decisão | Cenários |
|---|---|
| D-02 | rótulo "Criados em"; presets recalculados ao virar o dia (o teste de caracterização de `PeriodFilter` deve inverter) |
| D-07 | campo simples salva inline, mostra confirmação, **volta ao valor anterior em erro**; `hasUnsaved` continua protegendo Esc |
| D-08 | seções recolhíveis preservam rascunho ao recolher/expandir; foco e `aria-expanded` corretos |
| D-09 | valor total no cabeçalho da etapa; "tempo na etapa" secundário; sem campos agregados o card se comporta como hoje (compatibilidade) |
| D-12 | seções internas só em "Equipe GSM"; cliente comum nunca as vê; links do onboarding continuam válidos |
| D-13 | leads de antes de 0054 são marcados como histórico incompleto |

## Testes de acessibilidade a converter na Fase 1

Cada `it.fails` de `a11yBaseline.spec.tsx` deve virar `it` quando corrigido (14 itens — ver `06_FALHAS_CONHECIDAS.md`): é o critério de aceite objetivo da Fase 1.
