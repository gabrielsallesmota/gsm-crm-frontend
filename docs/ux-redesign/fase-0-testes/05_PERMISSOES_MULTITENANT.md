# 05 — Permissões e isolamento multi-tenant

Princípio: **a autoridade é o backend**. Os testes de frontend só garantem que a UI espelha as regras e não se mova para fora dos guards; nenhum deles é usado como evidência de segurança. Cada linha indica onde a regra é provada no **backend**.

## Matriz de autorização (escopo do redesign)

Legenda: ✓ permitido · ✗ recusado (403) · "próprios" = só leads em que é o dono · — não se aplica.

| Ação | Admin | Gestor | Vendedor | Staff GSM | Suporte (somente leitura) | Prova no backend | Espelho na UI |
|---|---|---|---|---|---|---|---|
| Listar/ver leads | todos | todos | próprios | do tenant interno | ✓ leitura | `test_rbac.py`; `test_ux_safety_net::…another_sellers_lead` | RTG, PIP (filtro de dono some p/ vendedor) |
| Criar/editar/mover lead | ✓ | ✓ | próprios | — | ✗ | `test_leads_crud`; `test_stage2_platform` (suporte 403) | DRW |
| Reatribuir responsável | ✓ | ✓ | ✗ (só vê) | — | ✗ | `leads.assign` (`test_lead_owner_validation`) | DRW *F-15* |
| **Excluir lead** | ✓ | ✓ | **✓ nos próprios** | — | ✗ | `test_ux_safety_net::…vendedor_can_delete_his_own_lead` | DRW *F-20* |
| Importar planilha | ✓ (escolhe dono) | ✓ (escolhe dono) | ✓ (sempre para si) | — | ✗ | `test_ux_safety_net` (3 testes de importação por papel/tenant/suporte) | IMP |
| Exportar CSV | ✓ | ✓ | próprios | — | ✗ | `test_commercial_regression` | PIP |
| Configurar pipelines/etapas | ✓ | ✓ | ✗ | — | ✗ | `test_ux_safety_net::…pipeline_configuration…`; `test_commercial_regression` | RTG, SET |
| Templates de WhatsApp (gerenciar) | ✓ | ✓ | ✗ (lista ✓) | — | ✗ | `test_leads_csv_and_templates` | SET |
| Tags (criar/excluir) | ✓ | ✓ | ✗ (lista ✓) | — | ✗ | `test_tags.py` | SET |
| Equipe/usuários | ✓ | ver | ✗ | — | ✗ (criar/alterar) | `test_user_management`, `test_stage2_platform` | RTG |
| Integrações (API keys, webhooks) | ✓ | ✗ | ✗ | — | ✗ | `test_commercial_regression` | RTG |
| Automações | ✓ edita | consulta | ✗ | — | consulta | `test_route_role_matrix` + `test_commercial_automations` | RTG |
| Área interna GSM (SDR, Clientes GSM) | ✗ | ✗ | ✗ | ✓ | ✗ | `test_stage2_platform`, `test_sdr_*` | RTG (`platform.internal` → 404) |

## Isolamento entre organizações

| Garantia | Teste (backend) | Teste (frontend) |
|---|---|---|
| Tenant A não lista/move/vê leads de B | `test_tenant_isolation.py` (existente) | — |
| Filtrar por pipeline/etapa de B devolve vazio; pipelines de B não aparecem | `test_ux_safety_net::…never_sees_or_filters…` (novo) | — |
| Importar para pipeline/etapa/dono de outro tenant é recusado e nada é gravado | `test_ux_safety_net::…refuses_pipeline_stage_or_owner…` (novo) | — |
| Templates e tags de um tenant não aparecem em outro | `test_ux_safety_net::…template_rules…` (novo); `test_tags::…isolated_by_tenant` (existente) | — |
| Mover para etapa de outro tenant é recusado | `test_pipeline_invariants::…another_tenant_is_refused` (existente) | — |
| **Trocar de tenant invalida o estado anterior** | — | PIP `trocar de tenant descarta o quadro anterior e recarrega` (novo) |
| Cache de leituras compartilhadas é por tenant | — | PIP/harness (`pipelines:<tenant>` invalida a cada render) |
| RLS por tabela | `test_rls_catalog.py` (existente) | — |

## Feature flags

| Garantia | Backend | Frontend |
|---|---|---|
| `crm` desligada: leads e importação → 403 para todos | `test_ux_safety_net::…crm_feature_disabled…` (novo) | RTG (rota some atrás de "não contratado") |
| Features reservadas só por ambiente | `test_stage2_platform`, `test_crm003b1_settings` | RTG (padrões do catálogo) |
| Default quando o backend não informa features | — | RTG `padrões do catálogo…` |

## Sessões de suporte (impersonation)

| Regra | Backend | Frontend |
|---|---|---|
| Começa somente leitura; escrever exige elevação auditada | `test_stage2_platform::…read_only_by_default…` | RTG (`can()` bloqueia ações sensíveis) |
| Importação bloqueada em leitura | `test_ux_safety_net::…import_is_blocked_in_a_read_only_support_session` (novo) | — |
| Mesmo elevada, não exporta, não exclui lead, não gere usuários | `test_stage2_platform::test_elevation_allows_writes…` | RTG |
| O token de suporte não opera a plataforma nem a área interna | idem | RTG (`platform.internal` falso em suporte) |
| UI não "adivinha" o modo: a recusa chega do servidor | — | DRW `sessão de suporte somente leitura…` (mostra a mensagem do backend) |

## Observações para o redesign

1. **Vendedor exclui os próprios leads** (D-06 recomenda manter): qualquer UI nova de exclusão deve preservar a confirmação e **não** ampliar para leads alheios.
2. O frontend **não se esconde** na sessão de suporte somente leitura (o botão de mover funciona e o servidor responde 403): é uma melhoria de UX, não de segurança.
3. Staff GSM e "Super Admin" compartilham `isPlatformStaff`; não há papel de Super Admin distinto no cliente do CRM — os testes usam `STAFF`.
