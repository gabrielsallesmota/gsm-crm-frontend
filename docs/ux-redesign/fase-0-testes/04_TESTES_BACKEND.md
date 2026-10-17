# 04 — Testes de backend (Fase 0)

Infraestrutura usada: **pytest + pytest-asyncio + httpx** contra o **Postgres real de teste** (banco recriado pelo `conftest`, migrations aplicadas, RLS ativa) — a mesma da suíte existente. Nenhuma dependência nova, nenhuma migration, nenhum dado real.

## O que já existia e foi **reaproveitado** (não duplicado)

| Tema | Arquivo existente | Casos relevantes |
|---|---|---|
| Importação: dedupe e etapa de outro pipeline | `test_leads_csv_and_templates.py` | `test_bulk_import_dedupe_strategies`, `…rejects_stage_from_another_pipeline` |
| Templates de WhatsApp | idem | CRUD, coringa, duplicidade (409), vendedor não gerencia |
| Mover e movimentação concorrente | `test_leads_crud.py`, `test_pipeline_invariants.py` | mover válido/inválido, `concurrent_move_waits…`, `move_to_a_stage_of_another_tenant_is_refused` |
| Invariantes de pipeline/etapas | `test_pipeline_invariants.py`, `test_pipelines_crud.py` | padrão único, último pipeline, última etapa aberta, permutação completa, etapa com leads |
| Ganho/Perdido e efeitos | `test_commercial_regression.py`, `test_leads_client_trigger.py` | evento + webhook de perda, reabrir ganho, cliente só no tenant interno |
| RBAC e isolamento | `test_rbac.py`, `test_tenant_isolation.py`, `test_route_role_matrix.py` (arquitetura) | vendedor só os próprios, gestor todos, tenant A × B |
| Exportação | `test_commercial_regression.py` | neutraliza fórmulas, vendedor só os próprios |
| Sessões de suporte | `test_stage2_platform.py`, `test_impersonation.py` | somente leitura por padrão, elevação, bloqueios sensíveis |
| Tags | `test_tags.py` | CRUD, duplicidade, vendedor, isolamento |

## O que foi **criado** — `tests/integration/test_ux_safety_net.py` (43 testes executados)

| Grupo | Testes | Comportamento caracterizado |
|---|---|---|
| Importação — volume | 1/500/2.000 aceitos (3); 2.001 e 10.000 → **422 do lote inteiro, nada gravado** (2); lote vazio → 422 | limite atual de 2.000 por requisição; **D-10 (10.000 em lotes) é futuro** |
| Importação — entrada | linha inválida no esquema (origem fora do enum, UF > 2, nome > 200) derruba o **lote inteiro** (3); coluna desconhecida é ignorada; nome vazio/espaços/tab = erro da linha, as demais seguem (3); telefone/e-mail inválidos não bloqueiam (vira lead sem telefone normalizado); defaults de etapa/dono/origem + evento `created` com `source=import` | explica por que a tela descarta origem desconhecida antes de enviar |
| Importação — duplicados | duplicado dentro do mesmo arquivo nas 3 estratégias; `skip` informa **qual lead** já tinha o telefone; `update` altera **só** os campos da linha (etapa, dono e origem intactos); `update` substitui telefone/WhatsApp quando enviados | corrige a Auditoria 01 (IMP-08) — ver `06_FALHAS_CONHECIDAS.md` |
| Importação — permissões | vendedor importa sempre para si (ignora `default_owner_id`); vendedor nunca atualiza nem vê o nome de lead de outro dono; pipeline/etapa/dono de **outro tenant** recusados; sessão de suporte somente leitura → 403 e nada gravado | |
| Contrato do lead | campos que o card usa existem; os indicadores do redesign (`next_activity_at`, `overdue_tasks_count`, `stage_entered_at`, `last_activity_at`) **ainda não existem** | marca o que a Fase 5 precisa criar |
| **D-01 última interação** | `last_interaction_at` só é gravado ao **mover**; comentário, tarefa concluída, edição e import-update **não** o alteram | documenta a diferença para a D-01 aprovada |
| Movimento | mesma etapa = sem mudança e sem evento; movimento grava `from`/`to` na timeline | |
| Listagem | período filtra por **criação**; busca por nome/empresa/e-mail/telefone; `%` age como curinga e telefone formatado não casa com dígitos; `sort_by` (name, expected_value…), `sort_dir` inválido = 422, `page_size` ≤ 1000, `page` ≥ 1; total real por etapa | PIP-17, D-02 |
| Timeline | padrão 100 itens, `limit` até 500, 501 = 422 | DRW-05 |
| Permissões | vendedor exclui o **próprio** lead (auditado sem dados pessoais) e nunca o de outro; vendedor não lê/edita/move/vê timeline de lead alheio; feature `crm` desligada bloqueia leads e importação para todos; gestor cria pipeline, vendedor não nem cria etapa | D-06 |
| Configurações | etapa com leads → 409 e nada se perde; excluir etapa vazia **apaga seus templates**; templates: mensagem em branco recusada, coringa × específico, duplicidade 409, outro tenant não vê nem usa a etapa; excluir tag a **desanexa** dos leads; pipeline com leads → 409 | CFG-03 |
| Isolamento | filtrar por pipeline/etapa de outro tenant devolve vazio; pipelines de outro tenant não aparecem | |

## Cenários **planejados** — `tests/integration/test_planned_future_phases.py` (14 `skip` com motivo "PLANEJADO")

Importação em lotes (D-10: 10.000 linhas/500, falha parcial, reprocessamento idempotente, duplicado entre lotes, cancelamento, relatório final, auditoria por lote), D-01 (3), D-03, D-05, D-09 (agregados), D-13. **Não são testes verdes**: aparecem como `skipped`, cada um com a decisão que o libera (detalhe em `07_TESTES_FUTUROS.md`).

## Lacunas conhecidas no backend

1. Concorrência de **duas importações simultâneas** com o mesmo telefone não é testada (o lote é sequencial dentro da requisição; a corrida entre requisições depende de índice único inexistente em `phone_normalized`) — relevante para D-10.
2. Desempenho com dezenas de milhares de leads (busca `ilike` sem índice trigram) não é medido.
3. Backfill de eventos para leads anteriores à migration 0054 (D-13) não é testável sem dados legados.
4. Webhooks disparados por importação em massa não foram exercitados (a entrega de webhooks tem suíte própria).
