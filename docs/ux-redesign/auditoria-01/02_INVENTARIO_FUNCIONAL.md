# 02 — Inventário funcional

Fonte: `src/routes/index.tsx`, componentes e hooks citados. [C] salvo indicação.

## Stack e arquitetura (frontend)

- React 19, React Router 7, TypeScript 6, Vite 8, Vitest 4 + Testing Library; **sem biblioteca de UI, de estado global, de formulários ou de DnD**. CSS Modules + tokens em `src/styles/theme.css` (tema escuro base e claro por `data-theme`).
- Padrão de dados: `pages` → `hooks` (`useAsyncResource`, hooks de ações) → `services` (`selectRepository` demo/API) → `repositories/api` (`apiRequest`). Estado de servidor é local em hooks; **não há cache compartilhado** entre telas.
- 115 arquivos `.tsx` em `components`, `pages` e `platform`; 42 entradas de rota.

## Rotas no escopo

| Rota | Componente | Guarda | Observação |
|---|---|---|---|
| `/pipeline` | `PipelinePage` (532 linhas) | feature `crm` | também renderiza `ProspectionBoard` para staff GSM (lazy) |
| `/leads`, `/leads/:id` | `LeadsPage` (677) | feature `crm` | tabela/lista; "Novo lead" (`?novo=1`) |
| `/configuracoes` | `SettingsPage` (785) | `settings.manage` (admin, gestor) | página única |
| `/configuracoes/integracoes` | `IntegrationsPage` | `integrations.manage` (admin) | |
| `/configuracoes/automacoes` | `AutomationsPage` | `automations.view` | admin edita |
| `/configuracoes/notificacoes` | `NotificationsSettingsPage` | feature + `notifications.view` | |
| `/perfil/notificacoes` | `MyNotificationsPage` | feature | |
| `/perfil/conexoes` (+ callback) | `MyConnectionsPage` | feature | |
| `/equipe` | `UsersPage` | `users.view` | |

O Pipeline abre o lead em **estado local** (`selectedLeadId`, `PipelinePage.tsx:146`) — não há rota/URL do lead aberto no Pipeline; só `/leads/:id` na lista.

## Componentes e hooks do escopo

| Arquivo | Linhas | Papel |
|---|---|---|
| `pages/PipelinePage.tsx` | 532 | cabeçalho, filtros, quadro, `KanbanCard` (interno) |
| `hooks/usePipelineBoard.ts` | 138 | uma consulta por etapa, "carregar mais", move otimista com rollback, geração para descartar respostas antigas |
| `utils/pipelineBoard.ts`, `utils/boardSort.ts` | — | estado do quadro; ordenação **no cliente** |
| `components/leads/LeadDrawer.tsx` | 598 | painel do lead (edição, etapa, dono, tags, notas, tarefas, atividades, exclusão) |
| `components/leads/LeadImportModal.tsx` | 301 | importação CSV (arquivo → mapeamento → resumo) |
| `components/leads/WhatsappButton.tsx`, `EmailButton.tsx` | 46 / 26 | ações de contato |
| `components/leads/LeadMessageTemplatesSettings.tsx` | 234 | templates de WhatsApp por etapa × origem |
| `components/common/Modal.tsx`, `ConfirmDialog.tsx`, `useDialog.ts` | — | diálogos acessíveis |
| `components/common/PeriodFilter.tsx` | — | filtro de período compartilhado (Pipeline e Dashboard) |

## Ações por tela

**Pipeline**: selecionar pipeline (se houver mais de um), buscar, filtrar por responsável (quem tem `leads.viewAll`), ordenar, filtrar período, importar planilha, exportar CSV, arrastar card entre etapas, mover por select, abrir lead, carregar mais por coluna, reordenar colunas por arrastar (quem tem `pipeline.reorder`), WhatsApp e e-mail no card.

**Lead (painel)**: trocar etapa e responsável (aplicam na hora), editar dados (salvar explícito), tags, notas, criar/concluir tarefa, comentar, ver timeline, WhatsApp/e-mail, excluir.

**Importação**: escolher arquivo, mapear colunas, escolher etapa de entrada, responsável (admin/gestor), estratégia de duplicados (ignorar/atualizar/duplicar), importar, ver resumo e erros por linha.

**Configurações**: pipelines (criar, renomear/cor, padrão, excluir), etapas (criar, editar nome/cor/ganho/perdido, reordenar por setas, excluir), tags (criar, excluir), origens (somente leitura), templates de WhatsApp (criar, editar, excluir); para staff GSM: estágios, templates e IA da Prospecção.

## Estados cobertos

Carregando (`SkeletonRows`, "Carregando…"), erro de pipeline/coluna com "Tentar de novo", vazio (sem pipeline, sem etapas, funil vazio, coluna sem leads), movimento em andamento (card translúcido, `aria-busy`), conflito de movimento ("Aguarde…"). **Não cobertos**: lista de timeline paginada, estado de erro específico na importação além de uma linha de texto vermelho.

## Permissões relevantes (UI espelha backend)

| Ação | admin | gestor | vendedor | Origem |
|---|---|---|---|---|
| Ver todos os leads / filtrar por responsável | ✓ | ✓ | só os próprios | `leads.viewAll`; `ensure_can_access_lead` |
| Reatribuir responsável | ✓ | ✓ | — | `leads.assign` |
| Reordenar etapas | ✓ | ✓ | — | `pipeline.reorder` |
| Configurações / templates | ✓ | ✓ | — | `settings.manage`; `require_tenant_role` |
| Excluir lead | ✓ | ✓ | **✓ nos próprios** | `DeleteLeadUseCase` (ver DRW-07) |
| Importar | ✓ (escolhe dono) | ✓ | ✓ (sempre para si) | `BulkImportLeadsUseCase` |

## Dependências de outras telas

`LeadDrawer` é usado também por `LeadsPage`; `PeriodFilter` pelo Dashboard; `Modal`/`ConfirmDialog`/`useDialog` por ~16 arquivos; `WhatsappButton` por Pipeline, Drawer e Prospecção (versão própria); `ProspectImportModal.module.css` é reutilizado por `LeadImportModal` (acoplamento de estilos entre módulos). Qualquer mudança nesses componentes precisa de teste de regressão nas telas dependentes.

## Divergências em relação à descrição do prompt

- "Automações" e "Notificações" já têm rotas próprias, mas aparecem na página de Configurações apenas como links em texto (`SettingsPage.tsx:298-309`); **Integrações** não tem link na página (só no menu lateral).
- O backend já suporta **origens configuráveis** (`/lead-sources`), classificação ativo/passivo e cadências, mas o frontend de leads não usa nada disso (ver CFG-04 e IMP-09).
