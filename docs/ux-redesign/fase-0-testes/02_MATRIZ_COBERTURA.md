# 02 — Matriz de cobertura F-01 a F-38

Legenda: **COBERTA** (comportamento atual protegido por teste automatizado) · **PARCIAL** (parte protegida; a lacuna está dita) · **NÃO COBERTA** · **MANUAL** · **FORA** (fora do escopo direto).
Siglas dos arquivos — Frontend (`gsm-crm-frontend/tests`): **PIP** `ui/pipelinePage.spec.tsx` · **DRW** `ui/leadDrawer.spec.tsx` · **IMP** `ui/leadImportModal.spec.tsx` · **CSV** `csvParser.test.ts` · **SET** `ui/settingsPage.spec.tsx` · **SHR** `ui/sharedComponents.spec.tsx` · **A11Y** `ui/a11yBaseline.spec.tsx` · **RTG** `ui/routeGuards.spec.tsx` · **LNK** `ui/leadsPageLinks.spec.tsx` · **PLN** `ui/plannedFuturePhases.spec.tsx`.
Backend (`gsm-crm-backend/tests/integration`): **UXS** `test_ux_safety_net.py` (novo) · **CSV-BE** `test_leads_csv_and_templates.py` · **CRUD** `test_leads_crud.py` · **PINV** `test_pipeline_invariants.py` · **PCRUD** `test_pipelines_crud.py` · **REG** `test_commercial_regression.py` · **RBAC** `test_rbac.py` · **ISO** `test_tenant_isolation.py` · **TAG** `test_tags.py` · **CLI** `test_leads_client_trigger.py` · **S2** `test_stage2_platform.py` · **IMP** (suporte) `test_impersonation.py`. · **1B-BE** `test_import_batches_and_sorting_1b.py` (Fase 1B). Frontend 1B: `leadImport.test.ts`, `ui/phase1bPipelineA11y.spec.tsx`, `ui/phase1bProspectA11y.spec.tsx`. Itens "(existente)" já estavam na suíte; "(novo)" foram criados nesta fase.

| ID | Funcionalidade | Classe | Evidência (testes) | Lacuna / observação |
|---|---|---|---|---|
| F-01 | Quadro por etapas reais, 25/página, "carregar mais", contador real, descarte de respostas antigas | **COBERTA** | PIP *F-01 carregamento* e *paginação*; UXS `test_stage_pagination_total_is_the_real_total_not_the_page` (novo) | — |
| F-02 | Mover por arrastar: otimista, rollback, bloqueio concorrente | **COBERTA** | PIP *F-02/F-03*; PINV `test_concurrent_move_waits…`, CRUD move (existentes) | Arrastar com toque/caneta: MANUAL |
| F-03 | Mover por alternativa (seletor) | **PARCIAL** | PIP (seletor muda etapa; mesma etapa não chama API); A11Y (alternativa existe) | 1B (PIP-05): seletor deixou de usar `display:none` (teste de varredura do CSS em `phase1bPipelineA11y`); aparência ao focar: **MANUAL** |
| F-04 | Reordenar etapas por permissão | **COBERTA** | PIP *F-04* (admin/gestor arrastável, vendedor não; permutação completa); SET (setas); PINV reorder (existente) | Alternativa por teclado no quadro: **CORRIGIDA na 1B (PIP-04)** — `phase1bPipelineA11y.spec.tsx` |
| F-05 | Seleção de pipeline (único/vários/padrão/troca) | **COBERTA** | PIP *F-01* (3 testes); SET | — |
| F-06 | Busca com debounce | **COBERTA** | PIP *F-06* (debounce e texto aparado); UXS busca por nome/empresa/e-mail/telefone e curingas (novo) | Escape de curinga: FALHA PIP-17 documentada |
| F-07 | Filtro por responsável / "sem responsável" | **COBERTA** | PIP *F-06..F-09*; RBAC `test_vendedor_only_sees_own_leads` (existente) | — |
| F-08 | Período (data de criação — D-02) | **COBERTA** | PIP (período na consulta, combinação, "Limpar"); SHR `PeriodFilter`; UXS `test_period_filter_uses_the_creation_date` (novo) | Presets "velhos" após meia-noite: caracterizado (PIP-07) |
| F-09 | Ordenação | **COBERTA** | **1B (PIP-02): ordenação global no servidor** — PIP (envio de sortBy/sortDir, 60/120 itens, repetidos, resposta antiga, falha); UXS whitelist; 1B-BE `test_pagination_with_repeated_values…`, `…null_values_always_sort_last`, `…sorting_is_global…` | Opções de valor/probabilidade existem na API, não na tela |
| F-10 | Importar planilha (arquivo, mapeamento, duplicados, limites) | **COBERTA** | CSV; IMP (lotes 1/500/501/2000/2001/10000, 10001 bloqueado, progresso, retomada, cancelar, retentativa); `leadImport.test.ts`; UXS; 1B-BE `test_import_batches_and_sorting_1b.py` (idempotência, escopo, concorrência, auditoria); CSV-BE | D-10 **implementado na 1B**; relatório após fechar a página: não (ver 1B/09) |
| F-11 | Exportar CSV | **PARCIAL** | PIP (chamada e erro); REG `test_export_neutralizes_formulas…`, `test_seller_export…` (existentes) | Download do arquivo no navegador (Blob): MANUAL |
| F-12 | Cartão do lead | **COBERTA** | PIP *F-12*; UXS contrato da listagem (novo) | Sinais de atenção: inexistentes (futuro) |
| F-13 | Abrir/fechar o painel do lead | **COBERTA** | DRW *F-13*; PIP (abre por clique/Enter/Espaço) | URL do lead no Pipeline: não existe (DRW-08) |
| F-14 | Editar dados do lead | **COBERTA** | DRW *F-14* | Validação inline: não existe (DRW-04) |
| F-15 | Trocar etapa e responsável no painel | **COBERTA** | DRW *F-15*; UXS `test_vendedor_cannot_move_edit_or_read…` (novo) | — |
| F-16 | Tags do lead | **PARCIAL** | DRW (alternar e enviar tags); TAG (existente); UXS `test_deleting_a_tag_detaches…` (novo) | Adicionar tag fora do modo edição: não existe |
| F-17 | Notas | **COBERTA** | DRW (exibe e salva) | — |
| F-18 | Tarefas do lead | **COBERTA** | DRW *F-18* | Editar tarefa no painel: não existe |
| F-19 | Comentários e timeline | **COBERTA** | DRW *F-19*; UXS timeline 100/500 e `last_interaction_at` (novo) | Paginação da timeline: FALHA DRW-05 |
| F-20 | Excluir lead | **COBERTA** | DRW *F-20*; UXS `test_vendedor_can_delete_his_own_lead…` (novo); REG (existente) | Regra do vendedor: D-06 (manter) |
| F-21 | WhatsApp do lead (templates, precedência, placeholders, sem template) | **COBERTA** | DRW *F-21/F-22*; PIP (links); `guardsAndWhatsapp.spec.tsx` e `leadMessageTemplates` (existentes) | — |
| F-22 | E-mail do lead (`mailto:`) | **COBERTA** | DRW; PIP | — |
| F-23 | Etapas Ganho/Perdido (efeitos) | **COBERTA** | PIP/DRW (avisos, sem confirmação — D-03 futuro); REG `test_lost_lead_records_event_emits_webhook…`, `test_reopening_a_won_lead…`; CLI (cliente só no tenant interno) (existentes) | Confirmação de perda: **PLANEJADO** |
| F-24 | Pipelines (listar, criar, renomear, cor, padrão, excluir) | **COBERTA** | SET *F-24*; PCRUD, PINV (existentes); UXS `test_pipeline_with_leads_cannot_be_deleted` (novo) | — |
| F-25 | Etapas (criar, editar, reordenar, excluir, finais, dependências) | **COBERTA** | SET *F-25*; PINV (existentes); UXS (cascata de templates, etapa com leads) (novo) | Criar etapa com Ganho/Perdido: não existe (CFG-05) |
| F-26 | Tags (listar, criar, cor, excluir, erros) | **COBERTA** | SET *F-26*; TAG (existente) | Exclusão sem confirmação: FALHA CFG-02 |
| F-27 | Origens (lista estática) | **COBERTA** | SET (oito origens, sem edição) | D-04: manter |
| F-28 | Templates de WhatsApp (CRUD, precedência, duplicidade, placeholders) | **COBERTA** | SET *F-28*; CSV-BE (existente); UXS `test_template_rules…` (novo) | Prévia: não existe (CFG-07) |
| F-29 | Automações e Notificações: navegação e guardas | **PARCIAL** | SET (links por feature/papel); RTG (guards) | As telas em si têm testes próprios das etapas 003B/003C (**FORA**) |
| F-30 | Integrações | **PARCIAL** | RTG (guard `integrations.manage`) | Conteúdo: **FORA** (testes da Etapa 3) |
| F-31 | Configurações internas da GSM (staff) | **PARCIAL** | SET (visível só a staff); RTG (`platform.internal`, suporte); S2 (existente) | Conteúdo das seções internas: **FORA** |
| F-32 | Permissões e feature flags | **COBERTA** | RTG; UXS (crm desligada, gestor × vendedor) (novo); RBAC, S2, `test_route_role_matrix.py` (existentes) | — |
| F-33 | Isolamento multi-tenant e troca de tenant | **COBERTA** | PIP (troca de tenant); UXS (import/filtros/templates entre tenants) (novo); ISO (existente) | — |
| F-34 | Modo demonstração × API | **PARCIAL** | SHR (`resolveCrmMode`, `selectRepository`) | Repositórios *mock* em execução: NÃO COBERTOS |
| F-35 | Estados vazios, onboarding e links `?importar=1`/`?novo=1` | **PARCIAL** | LNK; PIP (vazios, `?importar=1`); `stage4.test.ts` (existente) | Checklist de onboarding na UI: NÃO COBERTO |
| F-36 | Tema claro e escuro | **PARCIAL** | A11Y (contraste dos tokens nos dois temas) | Alternância/visual: **MANUAL** |
| F-37 | Toasts e erros descritivos | **COBERTA** | SHR *toasts*; PIP/DRW/SET (mensagens por status) | — |
| F-38 | Modal acessível e proteção de dados | **COBERTA** | SHR *Modal* e *ConfirmDialog*; DRW (Esc/fundo com rascunho, empilhamento) | Importação fora do padrão: FALHA IMP-01 |

## Totais

| Classe | Quantidade | IDs |
|---|---|---|
| COBERTA | 29 | F-01, 02, 04–10, 12–15, 17–28, 32, 33, 37, 38 |
| PARCIAL | 9 | F-03, 11, 16, 29, 30, 31, 34, 35, 36 |
| NÃO COBERTA | 0 | — |
| Total | 38 | |

Itens **MANUAL** associados (não automatizáveis aqui): arrastar com toque/caneta, `@media` do seletor de etapa no desktop, alternância de tema, leitor de tela, zoom 200/400 %, alvos de toque (ver `06_FALHAS_CONHECIDAS.md` e `08_RELATORIO_EXECUCAO.md`). Itens **FORA**: o conteúdo das telas de Automações, Notificações, Integrações e das seções internas da GSM tem suítes próprias das etapas anteriores.

> Não se declara cobertura completa: "COBERTA" significa que o **comportamento atual** está protegido, inclusive suas limitações; as falhas conhecidas (06) e os itens PARCIAIS seguem abertos.
