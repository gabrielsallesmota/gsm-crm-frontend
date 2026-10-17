# 07 — Auditoria do backend (escopo do redesign)

Repositório `gsm-crm-backend` (FastAPI, SQLAlchemy async, Postgres com RLS, arq worker, arquitetura hexagonal). Somente leitura. [C] salvo indicação.

## Endpoints relacionados

**Leads** (`/api/v1/leads`, `leads/adapters/inbound/router.py`) — 11: `POST ""` (criar), `GET ""` (listar), `GET /export`, `POST /bulk-import`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}`, `PATCH /{id}/move`, `GET /{id}/timeline`, `POST /{id}/comments`, `GET /{id}/comments`.
**Templates de WhatsApp** (`/api/v1/lead-message-templates`) — 4: criar, listar, atualizar, excluir (admin/gestor).
**Pipelines** (`/api/v1/pipelines`) — 9: criar, listar, `PATCH /reorder`, obter, atualizar, excluir, `POST /{id}/default`, `POST /{id}/stages`, `GET /{id}/stages`. **Etapas** (`/api/v1/stages`) — 3: `PATCH /reorder`, `PATCH /{id}`, `DELETE /{id}`.
**Tags** — 3 · **Tarefas** — 5 · **Automações** — 2 · **Notificações** — 7 (config usada na tela de Configurações).
**Origens, aquisição e cadências** (`acquisition_router.py`) — 14, **não consumidos pelo frontend de leads**.
Total: 44 no escopo central e 14 adicionais mapeados.

O frontend usa (de fato) `leads` (lista, criar, atualizar, mover, excluir, timeline, export, bulk-import), `lead-message-templates`, `pipelines`/`stages`, `tags` e `tasks` — ver `repositories/api/*`.

## Regras relevantes para o redesign

| Tema | Regra real | Evidência |
|---|---|---|
| Acesso a leads | vendedor só acessa os próprios (leitura, edição, mover, **excluir**); gestor/admin, todos do tenant | `leads/domain/services.py:34-38`, `use_cases.py:619-657` |
| Mover | trava o lead (`get_for_update`); etapa precisa ser do mesmo pipeline; mover para a mesma etapa não gera evento; grava `last_interaction_at`; evento `stage_changed`/`won`/`lost` com `from`/`to` | `use_cases.py:632-686` |
| Efeitos colaterais do "Ganho" | no **tenant interno da GSM**, mover para etapa ganha cria um Cliente (`maybe_create_client_from_lead`); outros tenants não | `router.py:579-613` |
| Eventos externos | movimentos disparam eventos de webhook (`lead.stage_changed`, `lead.won`, `lead.lost`) | `webhooks/domain/entities.py:19-28` |
| Ordenação de etapas | permutação completa; transação com lock do pipeline | `pipelines/application/use_cases.py:276-293` |
| Exclusão de etapa | 409 se há leads (FK `RESTRICT` → `ConflictError`); precisa manter ≥ 1 etapa aberta; apaga templates da etapa (cascata) | `pipelines/adapters/outbound/repository.py:221-233`, `use_cases.py:257-273` |
| Exclusão de pipeline | 409 se padrão, se único ou se tem leads | `use_cases.py:128-150` |
| Listagem | filtros: pipeline, etapa, dono, origem, aquisição, fonte, tag, sem-dono, busca (nome/empresa/e-mail/telefone `ilike`), criação de/até; ordenação por `name`, `created_at`, `updated_at`, `expected_value`, `probability`, `last_interaction_at`; `page_size` até 1000 | `router.py:245-307`, `repository.py:36-43, 212-232` |
| Resposta da listagem | injeta em lote tags, último comentário e **próximo passo da cadência** (sem N+1) | `router.py:145-176, 292-307` |
| Importação | máx. **2.000 linhas**; dedupe por telefone (skip/update/duplicate); vendedor nunca atualiza lead de outro dono; nome vazio vira erro da linha; resposta por linha | `schemas.py:144-170`, `use_cases.py:~720-860` |
| Exportação | CSV com BOM, células neutralizadas contra fórmula, auditoria `leads.exported`, bloqueada em suporte da GSM | `router.py:310-370` |
| Timeline | eventos + comentários, mais recentes primeiro, `limit` 1–500 (padrão 100) | `router.py:616-632` |
| Isolamento | RLS + `tenant_id`; exclusão de lead audita sem dados pessoais | `router.py:541-575` |

## Indicadores comerciais — disponibilidade com os dados atuais

| # | Indicador | Classe | Detalhe e evidência |
|---|---|---|---|
| 1 | Última interação | **EXIGE DEFINIÇÃO** (+ DERIVÁVEL) | `last_interaction_at` só é gravado ao **mover** de etapa (`use_cases.py:670`); comentário, tarefa e atividade **não** o atualizam. Um "último contato" real pode ser derivado de `lead_events` (índice `lead_id, created_at`) e `lead_comments`, mas é preciso definir o que conta (comentário? tarefa concluída? WhatsApp?). Exibir o campo atual com o rótulo "última interação" seria enganoso. |
| 2 | Próxima atividade | **DERIVÁVEL** (+ EXIGE BACKEND para expor no quadro) | Tarefa pendente mais próxima por lead (`lead_tasks`, índices `lead_id` e `(tenant_id, done, due_at)`) e `next_cadence_step` (já devolvido). Combinar as duas fontes numa chamada em lote exige novo campo na listagem. |
| 3 | Atividades atrasadas | **DERIVÁVEL** (+ EXIGE BACKEND no quadro) | `done = false AND due_at < agora` em `lead_tasks`; hoje só via `GET /tasks?lead_id=` (N chamadas, inviável no quadro). Agregar em lote na listagem. |
| 4 | Tempo na etapa atual | **DERIVÁVEL, com ressalva** | `max(created_at)` dos eventos `stage_changed/won/lost`, senão o evento `created`. **Não há backfill**: leads anteriores à migration 0054 não têm eventos (docstring da migration) → caem para `created_at`, impreciso. Pode exigir HISTORIZAÇÃO retroativa só para o legado, ou aceitar a imprecisão. |
| 5 | Tempo sem movimentação | **DERIVÁVEL** | `agora − max(criação, interações, eventos)`; a automação de follow-up (CRM-003C) já calcula isso em SQL (`automations/adapters/outbound/follow_up.py`, `_CANDIDATES_SQL`) — reaproveitar a definição. |
| 6 | Responsável | **DISPONÍVEL** | `owner_id`; nome via diretório da equipe no frontend. |
| 7 | Valor | **DISPONÍVEL** | `expected_value` (anulável; o frontend usa 0). Total por coluna: **DERIVÁVEL**, exige agregação no backend (a API devolve só `total` de itens). |
| 8 | Probabilidade | **DISPONÍVEL** | `probability` anulável (a UI mostra 0 %). Decidir se `null` deve aparecer como "—". |
| 9 | Histórico de movimentação | **DISPONÍVEL** (desde a migration 0054) | `lead_events` com `from`/`to`; sem eventos para movimentos anteriores à 0054. |

Nenhum indicador exige **nova tabela**. Os pontos 2, 3, 4 e 7 pedem um conjunto de **campos agregados opcionais** na listagem de leads (ver B-1).

## Necessidades de backend identificadas

| ID | Necessidade | Obrigatória para o redesign? |
|---|---|---|
| B-1 | Campos agregados na listagem: `next_activity_at`, `overdue_tasks_count`, `stage_entered_at`, `last_activity_at` (em lote, sem N+1) | Só para sinais de atenção completos (PIP-03 fase 2) |
| B-2 | Total de valor por etapa (`GET /pipelines/{id}/summary` ou campo no retorno por etapa) | Opcional (PIP-13) |
| B-3 | Motivo de perda (campo e regra) | Só se a decisão D-03 for "sim" |
| B-4 | Escape de curinga e busca por telefone normalizado | Opcional (PIP-17) |
| B-5 | Registrar interações por usuário (tipo + canal) | Só se D-05 for "sim" |
| B-6 | Cursor/paginação da timeline | Opcional (DRW-05; o parâmetro `limit` já existe) |

## Desempenho (hipóteses)

- `ilike '%x%'` em quatro colunas sem índice trigram; viável em tenants pequenos, pode degradar com dezenas de milhares de leads [H].
- A listagem faz três consultas em lote por página (tags, comentário, cadência) — adequado; acrescentar agregados deve manter o padrão em lote.
- O quadro dispara uma listagem por etapa por mudança de filtro (PIP-10); o custo é multiplicado pelo número de etapas.

## Divergências documentais

- Comentário de `list_leads` afirma que o kanban carrega o pipeline "numa página só (`pageSize: 200`)" (`router.py:~262-267`); hoje o quadro pagina por coluna com 25. O limite `le=1000` permanece válido.
- `boardSort.ts:1-6` repete a premissa antiga (200 itens).
