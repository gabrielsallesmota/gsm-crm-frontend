# Auditoria de SaaS / Commercial Readiness — gsm-crm-frontend

- **Data:** 2026-09-27
- **Escopo:** `gsm-crm-frontend` (React 19 + Vite 8 + react-router 7, TypeScript), working tree limpo no início.
- **Tipo:** diagnóstico somente leitura. Nenhum arquivo do produto foi alterado; o build foi gerado numa pasta temporária fora do projeto. Este arquivo é o único artefato criado.
- **Complementa:** `gsm-crm-backend/docs/audits/SAAS_BACKEND_READINESS_AUDIT.md` (IDs `BE-*` abaixo referem-se àquele relatório).

> **Severidade:** P0 bloqueia venda · P1 antes do primeiro cliente · P2 pós-lançamento próximo · P3 evolução
> **Estado:** EXISTS · PARTIAL · MISSING · NOT_VERIFIABLE

---

## 1. Executive Summary

**Pergunta:** *"Consigo entregar esse frontend amanhã para uma empresa real usar sem explicar tecnicamente o sistema e sem expor funcionalidades internas da GSM?"*

**Resposta curta: não, ainda não.** Um cliente consegue logar, ver um dashboard, cadastrar leads num pipeline padrão, arrastar cards, comentar, criar tarefas e compromissos. O código é limpo (lint e typecheck sem erro, build ok), a separação interna/cliente no **menu** está feita, e o frontend nunca envia `tenant_id` escolhido pelo usuário — o tenant sempre vem do token.

O que impede a entrega:

1. **O pipeline do frontend não é o pipeline do backend.** A UI reduz qualquer funil a 5 colunas fixas (`novo / contato / proposta / ganho / perdido`). Se o cliente tiver mais de 3 etapas em andamento — por exemplo *Entrada → Qualificação → Contato → Follow-up → Negociação* — as etapas extras são fundidas em "Proposta", ficam invisíveis no quadro e o arraste manda o lead para a etapa errada. Funciona **apenas** com o pipeline padrão.
2. **O mesmo app serve telas internas e públicas da GSM.** `/terapeuta-da-vez` e `/terapeuta-da-vez/gestao` estão fora do login, e o bundle que qualquer cliente baixa contém todas as chamadas do SDR (54 ocorrências de `/api/v1/sdr`), de prospecção, de clientes GSM, do painel público e as credenciais do modo demonstração.
3. **A sessão cai sozinha.** Depois de renovar o token em memória, o app não salva os tokens novos, e várias requisições em paralelo disputam a renovação. Na prática, o usuário é deslogado ao recarregar a página ou ao abrir telas que fazem várias chamadas ao mesmo tempo.
4. **Não existe nenhuma tela de Super Admin** (organizações, suspensão, impersonation, auditoria, API Keys) — o frontend não chama nenhuma rota `/api/v1/platform/*`, `/audit-logs` ou `/api-keys`.
5. **O admin do cliente não administra a equipe:** só consegue adicionar usuário (definindo senha visível na tela). Não há editar, desativar ou mudar papel.
6. **Erros aparecem como sucesso ou somem:** o toast sempre mostra um "✓" verde, há ações sem tratamento de erro (tarefas, agenda, mover lead, criar usuário) e não existe error boundary.
7. **Pelo celular não dá para mover leads:** o quadro depende de drag-and-drop HTML5 (sem suporte a toque) e o drawer do lead não tem seletor de etapa.

**Recomendação:** não liberar para tenant externo antes de resolver os 2 P0 e os P1 listados em §28. O primeiro cliente só deve entrar com o pipeline padrão e acompanhamento humano, mesmo depois disso, até o onboarding existir.

| Área | Estado | Nota (0–10) |
|---|---|---|
| Qualidade técnica (lint/types/build) | EXISTS | 8 |
| Separação Platform × Tenant | PARTIAL (só menu) | 4 |
| SDR isolado | PARTIAL (menu; bundle e rotas expostos) | 5 |
| Super Admin | MISSING | 0 |
| Admin do tenant | PARTIAL | 3 |
| Leads | PARTIAL | 5 |
| Pipeline | PARTIAL (quebrado para funis customizados) | 3 |
| Tarefas/lembretes | PARTIAL | 3 |
| Dashboard | PARTIAL (KPI fictício) | 5 |
| Integrações/API | MISSING | 0 |
| Onboarding | MISSING | 1 |
| Estados de UI / erros | PARTIAL | 4 |
| Mobile | PARTIAL | 4 |
| Acessibilidade | PARTIAL | 3 |
| Segurança frontend | PARTIAL | 5 |

---

## 2. Frontend Architecture

| Aspecto | Implementação | Evidência |
|---|---|---|
| Framework | React 19, Vite 8, TypeScript 6, CSS Modules | `package.json` |
| Dependências de runtime | **só** `react`, `react-dom`, `react-router-dom` | `package.json` |
| Routing | `createBrowserRouter`, todas as páginas importadas estaticamente (sem lazy) | `src/routes/index.tsx` |
| Layouts | `AppLayout` (sidebar + topbar, dentro de `ProtectedRoute`), `AuthLayout` (login/senha) | `src/layouts/` |
| Estado global | React Context: `AuthProvider`, `ToastProvider`, `ThemeProvider` | `src/contexts/` |
| Data fetching | hook próprio `useAsyncResource` (sem cache, sem dedupe, sem retry); ~70 hooks `useX`/`useXActions` | `src/hooks/useAsyncResource.ts` |
| API layer | `services/*Service` → `repositories/{api,mock}/*Repository` → `ApiClient.apiRequest` (fetch + Bearer + 1 refresh em 401) | `src/repositories/api/ApiClient.ts` |
| Modo demo × produção | `services/factory.ts` escolhe mock ou API por `VITE_CRM_MODE` ou pelo hostname | `resolveMode()` |
| Autenticação | JWT access + refresh salvos em `localStorage` (`gsm_crm_session`) | `AuthProvider.tsx` |
| Autorização | checagens `user.role`/`user.isPlatformStaff` espalhadas em layout e páginas; **nenhum guard de rota por papel** | §8 |
| Tenant context | `user.tenantId` do token; troca via `POST /auth/select-tenant` + reload | `AuthProvider.selectTenant` |
| Feature flags | MISSING (só `isDemoMode`) | — |
| Formulários | controlados à mão, sem biblioteca, validação mínima | páginas |
| Charts | componentes próprios em CSS (sem lib) | `src/components/charts/` |
| Tabelas | `<table>` HTML simples, sem paginação | `LeadsPage.tsx` |
| Modais | `Modal` genérico + overlays próprios por tela | `components/common/Modal.tsx` |
| Notificações | toast único (sempre com "✓"), 3,2 s | `ToastProvider`, `ToastHost` |
| Error boundaries | MISSING (nenhum `ErrorBoundary`/`errorElement`) | grep vazio |
| Loading | "Carregando…" em texto; `ProtectedRoute` retorna `null` enquanto carrega | páginas |
| Testes | MISSING (sem script de teste nem arquivos de teste) | `package.json` |

---

## 3. Route Inventory

Nenhuma rota tem `REQUIRED ROLE` aplicado pelo roteador. A coluna "Papel na UI" descreve só quem vê o item de menu; qualquer usuário logado abre qualquer rota protegida digitando a URL.

| ROUTE | PURPOSE | PAPEL NA UI (menu) | GUARD DE ROTA | TENANT / PLATFORM | PROTECTED? | API USED |
|---|---|---|---|---|---|---|
| `/login` | login + seleção de tenant | — | — | ambos | público | `POST /auth/login`, `/auth/select-tenant`, `/auth/me`, `/auth/tenants` |
| `/esqueci-senha` | pedir reset | — | — | ambos | público | `POST /auth/forgot-password` |
| `/redefinir-senha` | confirmar reset | — | — | ambos | público | `POST /auth/reset-password` |
| `/trocar-senha` | troca forçada | — | checa `user` no componente | ambos | exige sessão | `POST /auth/change-password` |
| `/terapeuta-da-vez` | quiosque do spa (cliente específico) | — | **nenhum** | **cliente específico, global** | **público** | `/api/v1/public/terapeuta-da-vez/*` (polling) |
| `/terapeuta-da-vez/gestao` | gestão do spa | — | senha compartilhada (sessionStorage) | **cliente específico, global** | **público + senha** | `/api/v1/operations/*`, `/public/terapeuta-da-vez/*` |
| `/` | redirect | — | login | — | sim | — |
| `/dashboard` | KPIs do funil (+ prospecção p/ staff) | todos | login | tenant (+platform) | sim | `GET /dashboard`, `/prospects/dashboard` (staff) |
| `/pipeline` | kanban de leads (+ prospecção p/ staff) | todos | login | tenant (+platform) | sim | `/pipelines`, `/pipelines/{id}/stages`, `/leads`, `/leads/{id}/move`, `/stages/reorder`, `/leads/bulk-import`, `/leads/export`, `/lead-message-templates`, `/prospects*` (staff) |
| `/leads`, `/leads/:id` | tabela de leads + drawer (+ prospecção p/ staff) | todos | login | tenant (+platform) | sim | `/leads`, `/leads/{id}`, `/leads/{id}/comments`, `/tags`, `/prospects*` (staff) |
| `/clientes` | carteira de clientes da GSM | platform staff | **login apenas** | **platform** | sim | `/api/v1/clients*` |
| `/sdr/dashboard` | dashboard do SDR/custos | platform staff | **login apenas** | **platform** | sim | `/api/v1/sdr/*` |
| `/sdr/campanhas`, `/nova`, `/:id`, `/:id/execucoes/:runId` | campanhas e execuções | platform staff | **login apenas** | **platform** | sim | `/api/v1/sdr/campaigns*`, `/runs*` (polling 3 s) |
| `/sdr/presets` | ICP presets | platform staff | **login apenas** | **platform** | sim | `/api/v1/sdr/icp-presets*` |
| `/sdr/candidates`, `/:id` | triagem de candidates | platform staff | **login apenas** | **platform** | sim | `/api/v1/sdr/candidates*` |
| `/sdr/cobertura` | cobertura geográfica | platform staff | **login apenas** | **platform** | sim | `/api/v1/sdr/coverage*` |
| `/sdr/prospectar-hoje` | fila de prospecção | platform staff | **login apenas** | **platform** | sim | `/api/v1/sdr/prospecting*` |
| `/tarefas` | tarefas de leads | todos | login | tenant | sim | `/tasks`, `/leads?page_size=200` |
| `/agenda` | compromissos | todos | login | tenant | sim | `/calendar/events`, `/leads` |
| `/relatorios` | relatórios | todos | login | tenant | sim | `/reports` |
| `/configuracoes` | pipelines, estágios, tags, templates (+ prospecção p/ staff) | admin **e gestor** | **login apenas** | tenant (+platform) | sim | `/pipelines*`, `/stages*`, `/tags*`, `/lead-message-templates*`, `/prospect-*` (staff) |
| `/usuarios` | listar/criar usuários | admin **e gestor** | **login apenas** | tenant | sim | `GET/POST /users` |
| `/perfil` | dados + troca de senha | todos | login | ambos | sim | `/auth/change-password` |
| `*` | redirect para dashboard | — | login | — | sim | — |

Rotas nunca consumidas pelo frontend, embora existam no backend: `/api/v1/platform/*`, `/api/v1/accounts/{id}/tenants`, `/api/v1/accounts/{a}/tenants/{t}/api-keys`, `/api/v1/accounts/{id}/audit-logs`, `DELETE /api/v1/leads/{id}` (existe no repositório do frontend, mas nenhuma tela chama), `DELETE /tags`, `DELETE /pipelines`.

---

## 4. Platform × Tenant Separation

**Estado: PARTIAL — a separação existe só no menu e em blocos condicionais dentro das mesmas páginas.**

| Mecanismo | Evidência | Avaliação |
|---|---|---|
| Itens de menu `platformStaffOnly` (Clientes, SDR) | `AppLayout.tsx` `NAV_ITEMS` | ✔ visual |
| Blocos "Ativo/Passivo" e prospecção embutidos em Dashboard, Pipeline, Leads e Configurações quando `isPlatformStaff` | `DashboardPage.tsx:30`, `PipelinePage.tsx:38`, `LeadsPage.tsx:39`, `SettingsPage.tsx:50,425,568` | ◐ o produto do cliente e o funil interno da GSM convivem na mesma tela |
| Guard de rota para platform | MISSING | `routes/index.tsx` |
| App/bundle separado para platform | MISSING — tudo num chunk de 760 KB | build |
| Origem do `isPlatformStaff` | `/auth/me` no login, depois **lido do `localStorage`** a cada carga (nunca revalidado) | `AuthProvider.loadStoredSession` |

**Telas internas que um cliente consegue abrir (URL direta):** `/clientes`, todas as `/sdr/*`, e as seções de prospecção só aparecem se `isPlatformStaff=true` no `localStorage`. Um usuário que edite o próprio `localStorage` passa a **ver** o menu e as telas internas; os dados continuam bloqueados pelo backend (403 em todas as rotas SDR/prospects/clients — ver BE §6). Isso não vaza dados, mas vaza **existência, nomenclatura e estrutura** das ferramentas internas.

**Telas públicas da GSM no mesmo domínio:** `/terapeuta-da-vez` e `/terapeuta-da-vez/gestao` (P0-02).

---

## 5. Super Admin

**Estado geral: MISSING.** O frontend não tem nenhuma área de plataforma. O Super Admin da GSM hoje é "um usuário de tenant com menu extra".

| Capacidade desejada | Estado | Evidência |
|---|---|---|
| Lista de organizações | MISSING | backend tem `GET /platform/accounts|tenants`; o frontend não chama |
| Detalhe da organização (status, usuários, admin, features, uso, integrações) | MISSING | — |
| Criar organização / admin inicial | MISSING | backend só via CLI/agência |
| Editar / suspender / ativar | MISSING | backend também não tem |
| Gerenciar módulos/features | MISSING | backend também não tem |
| Saúde operacional | MISSING (só o dashboard do SDR) | `SdrDashboardPage` |
| Suporte / impersonation | MISSING (backend tem `POST /platform/tenants/{id}/impersonate`) | — |
| Auditoria | MISSING (backend tem `GET /accounts/{id}/audit-logs`) | — |
| Trocar de tenant | PARTIAL — seletor na topbar se o usuário tiver mais de uma membership | `AppLayout.tsx` `canSwitchRealTenant` |
| SDR interno | EXISTS (menu staff) | `/sdr/*` |
| Clientes GSM | EXISTS (menu staff) | `/clientes` |

**Risco de confusão:** hoje, o único jeito de o staff "entrar" no tenant de um cliente pela UI é ter uma **membership** nele (o seletor de tenant). Isso leva a criar staff como membro do cliente — o que no backend aciona o gatilho "Lead Ganho → Cliente GSM" e mistura dados internos no tenant do cliente (BE P2-03) — em vez de usar impersonation auditada.

---

## 6. Tenant Admin

| Capacidade | Estado | Evidência / observação |
|---|---|---|
| Listar usuários | EXISTS | `UsersPage` → `GET /users` (nome, e-mail, papel; o campo "Time" é sempre "—") |
| Criar usuário | PARTIAL | admin define **senha temporária em texto aberto**; a senha é **repetida no toast** (`UsersPage.tsx` `handleCreate`); sem `catch` → erro de API não aparece; campo "Time" é enviado ao nada (o backend não tem esse campo) |
| Convite por e-mail | MISSING | o próprio texto da tela afirma "O backend não tem convite por e-mail nem reset de senha ainda" — texto de desenvolvedor, e **desatualizado** (o reset existe) |
| Editar / desativar / remover / mudar papel | MISSING | sem UI e sem backend (BE P1-02) |
| Permissões granulares | MISSING | só 3 papéis |
| Configurações da organização (nome, logo, fuso, dados) | MISSING | `/configuracoes` só tem pipelines, tags, origens e templates |
| Pipelines e estágios | PARTIAL | cria pipeline e edita estágios; **não exclui**; estágios limitados pelo mapeamento fixo (P0-01) |
| Tags | PARTIAL | cria; exclusão existe no hook, não na tela (verificar) |
| Origens | EXISTS (somente leitura, lista fixa) | `SettingsPage` seção "Origens" |
| Templates de WhatsApp por estágio | EXISTS | `LeadMessageTemplatesSettings` |
| Integrações / API | MISSING | §13 |
| Auditoria da própria organização | MISSING | — |

**Confusão Super Admin × Admin do cliente:**
- `isAdmin` no layout é `role === "admin" || role === "gestor"` (`AppLayout.tsx:112`). O **gestor** vê "Usuários" e "Configurações" como admin, mas o backend só deixa **admin** criar usuário → o gestor preenche o formulário e a ação falha sem mensagem.
- O papel é exibido cru (`admin`, `gestor`) na sidebar e no perfil (`AppLayout.roleLabel`, `ProfilePage.tsx:43`).
- Quando o nome do tenant não está disponível, a UI mostra o **UUID do tenant** (`AuthProvider` `currentTenantName ?? user.tenantId`).

---

## 7. SDR Isolation

**Estado: PARTIAL.** A proteção real está no backend (verificada na auditoria do backend: `require_platform_staff` em todos os routers SDR). No frontend, a proteção é **somente visual**.

| Vetor | Estado | Evidência |
|---|---|---|
| Menu | ✔ oculto para não-staff | `NAV_ITEMS.platformStaffOnly` |
| Rotas `/sdr/*` | ✘ **sem guard** — qualquer usuário logado abre a tela; os dados falham com 403 | `routes/index.tsx` |
| Lazy routes | ✘ não há; o código das 9 telas SDR vai para todos | build: 1 chunk de 760 KB |
| Chamadas de API no bundle | ✘ 54 referências a `/api/v1/sdr`, 16 a `/api/v1/prospects`, 14 a `/api/v1/clients` | grep no bundle gerado |
| Custos, providers, campaigns, candidates | telas presentes no bundle; dados só via API (403 para tenant) | `SdrDashboardPage`, `SdrCampaignFormPage` |
| Polling | só ativo na tela de execução (`useSdrCampaignRun`, 3 s) | — |
| `sdr_admin` | ✘ o frontend não conhece esse papel: mostra botões de criar/editar campanha, preset e cobertura para qualquer staff; o backend recusa quem não é `sdr_admin` | grep sem `sdrAdmin` |
| Atalhos / links | nenhum link para SDR fora do menu staff | grep |

**Registro explícito:** *o frontend não é fronteira de segurança para o SDR.* Um usuário de tenant consegue navegar para `/sdr/dashboard` e ver a estrutura da tela (subnavegação, títulos como "Custos", "Score × Resultado") com erros de carregamento. Recomendação: guard de rota por `isPlatformStaff` revalidado com `/auth/me`, e o SDR/prospecção/clientes em um **bundle separado** (lazy + chunk próprio) ou, idealmente, em um app interno separado.

---

## 8. RBAC Matrix

### 8.1 Papéis conhecidos pelo frontend
`role` ∈ {`admin`, `gestor`, `vendedor`} (string livre em `AuthUser.role`) + `isPlatformStaff: boolean`. `gsm_admin` só existe no mock (`AuthProvider` `canSwitchTenant`). **Não conhece:** papéis de account (`owner`/`admin`) nem `sdr_admin`.

### 8.2 ROLE → menus / páginas / ações

| Elemento | vendedor | gestor | admin | platform staff | Backend (real) | Divergência |
|---|---|---|---|---|---|---|
| Menu Dashboard/Pipeline/Leads/Tarefas/Agenda/Relatórios | ✔ | ✔ | ✔ | ✔ | ✔ (vendedor filtrado) | — |
| Menu Configurações | ✘ (URL abre) | ✔ | ✔ | ✔ | GET todos; escrita admin/gestor | vendedor abre a tela e vê botões que falham |
| Menu Usuários | ✘ (URL abre) | ✔ | ✔ | ✔ | GET admin/gestor; POST **só admin** | gestor vê o formulário de criar → 403 |
| Menu Clientes / SDR | ✘ (URL abre) | ✘ (URL abre) | ✘ (URL abre) | ✔ | platform staff | proteção só visual |
| Criar/editar CRUD SDR | — | — | — | ✔ (todos) | só `sdr_admin` | botões para staff sem permissão |
| Arrastar coluna (reordenar estágios) no Pipeline | ✔ | ✔ | ✔ | ✔ | admin/gestor | vendedor consegue arrastar → toast de erro |
| Importar CSV / Exportar CSV | ✔ | ✔ | ✔ | ✔ | todos (vendedor limitado aos próprios) | ⚠ BOLA do import no backend (BE P1-05) |
| Editar lead / comentar | ✔ (só leads próprios chegam) | ✔ | ✔ | ✔ | idem | — |
| Excluir lead | ✘ (sem botão) | ✘ | ✘ | ✘ | permitido | UI não oferece |
| Reatribuir responsável | ✘ (sem campo) | ✘ | ✘ | ✘ | permitido | UI não oferece |
| Seções de prospecção em Dashboard/Pipeline/Leads/Configurações | ✘ | ✘ | ✘ | ✔ | platform staff | por `isPlatformStaff` do `localStorage` |
| Seletor de tenant | se tiver 2+ memberships | idem | idem | idem | revalida no banco | — |

### 8.3 Problemas estruturais
- **Nenhuma rota protegida por papel** — só por "estar logado".
- Checagens de papel por **comparação de string espalhada** (`role === "admin"`), sem um módulo de permissões.
- `isPlatformStaff` e `role` vêm do `localStorage` e só são atualizados em novo login (mudança de papel no backend não reflete até o usuário sair e entrar de novo).
- Toda autorização real depende do backend (correto), mas a UI oferece ações que o backend vai recusar, sem explicar por quê (o toast mostra o `detail` com um "✓").

---

## 9. Leads

Fluxo avaliado: *criar → visualizar → editar → atribuir → mover → atividade → lembrete → follow-up → ganho/perdido → histórico*.

| Passo | Estado | Evidência / observação |
|---|---|---|
| Criar | PARTIAL | modal rápido com nome, empresa, telefone, e-mail e valor; **dono = quem cria** (sem seletor), origem sempre `manual`, sem escolher etapa ou pipeline (vai para o default), sem validar e-mail; "+ Lead" da topbar só navega para `/leads` |
| Visualizar | PARTIAL | tabela com **no máximo 100 leads**, página 1 fixa, **sem paginação** (`useLeads({page:1,pageSize:100})`); `/leads/:id` só abre o drawer se o lead estiver entre os 100 carregados/filtrados |
| Busca | PARTIAL | nome/empresa/e-mail; **uma requisição por tecla** (sem debounce); busca da topbar ("Buscar leads, empresas…") **não faz nada** (input sem handler) |
| Filtros | MISSING na tabela (sem estágio, dono, origem, tag, período) | `LeadsPage` |
| Editar | PARTIAL | nome, empresa, telefone, e-mail, valor, probabilidade, notas, tags; sem cargo, cidade/UF, WhatsApp, origem |
| Atribuir responsável | MISSING | nem exibe o dono atual |
| Mover no pipeline | PARTIAL | só por arraste no quadro; o drawer não tem seletor de etapa; o rótulo de etapa no drawer vem de constante fixa, não do nome real (P0-01) |
| Registrar atividade | PARTIAL | comentários (texto livre) ✔; a seção "Timeline" **sempre** mostra "Sem atividades registradas ainda." (mapeada como `[]` fixo) |
| Lembrete / follow-up | PARTIAL | só na tela global `/tarefas`; o drawer mostra uma seção de tarefas que é sempre vazia (`tasks: []` no mapeamento) e não permite criar |
| Ganho / perdido | PARTIAL | arrastar para a coluna; sem motivo de perda, sem confirmação, sem valor fechado |
| Histórico | MISSING | depende do backend (BE P1-09) |
| Excluir / arquivar | MISSING na UI | — |
| Campos fictícios | ⚠ "temperatura" (quente/morno/frio) derivada da probabilidade, `firstContactHours: 0`, campos de IA vazios | `LeadsApiRepository.toLead` |
| Feedback | ✔ toast de sucesso/erro na criação e edição; ✘ erro com ícone "✓" |
| Loading | "Carregando…" no subtítulo; tabela vazia enquanto carrega |
| Empty state | "Nenhum lead encontrado." sem CTA; botão "Novo lead" desabilitado com tooltip se não houver pipeline |
| Mobile | tabela com scroll horizontal; drawer usável (ver §17) |
| Acessibilidade | linhas `<tr onClick>` sem foco de teclado; drawer sem `role="dialog"` |

---

## 10. Pipeline

| Aspecto | Estado | Evidência |
|---|---|---|
| Estágios | **quebrado para funis customizados** | `repositories/api/stageMapping.ts` colapsa estágios reais em 5 chaves; `PipelinesApiRepository.toPipeline` sempre gera 5 colunas a partir de `STAGE_ORDER` |
| Pipeline com 1–2 etapas intermediárias | coluna "fantasma" com o rótulo cru (`proposta`/`contato`) e cor cinza; soltar lead nela gera erro "Estágio do pipeline ainda não carregado — abra a tela de Pipeline antes de mover o lead." | `toPipeline` (`label: match?.name ?? key`), `LeadsApiRepository.move` |
| Pipeline com 4+ etapas intermediárias | etapas 3..N fundidas em "Proposta"; leads delas aparecem na mesma coluna; soltar em "Proposta" manda para a **última** etapa intermediária | `buildStageMap` (`Math.min(i, INTERMEDIATE_KEYS.length - 1)`) |
| Novo estágio criado em Configurações | retornado com `id: "novo"` fixo e, se exceder o mapeamento, fica **invisível** no quadro | `PipelinesApiRepository.createStage` |
| Movimentação | drag-and-drop HTML5 nativo | `PipelinePage.handleDrop` |
| Mover = 2 requisições | `GET /leads/{id}` + `PATCH /move` | `LeadsApiRepository.move` |
| Atualização concorrente | não tratada (sem versão/ETag); último a gravar vence | — |
| Optimistic update / rollback | não há; `await move(...)` **sem try/catch** → falha silenciosa (rejeição não tratada), card volta só no `reload` | `PipelinePage.handleDrop` |
| Loading | quadro inteiro só aparece depois de pipelines + estágios (N+1: 1 request de estágios por pipeline) | `toPipeline` |
| Limite | 200 leads por pipeline (`pageSize: 200`); acima disso, leads somem do quadro sem aviso | `LeadsPipelineBoard` |
| Filtros | período e ordenação; **sem** dono, origem, tag ou busca | — |
| Responsável / origem no card | origem sim; responsável não | `KanbanCard` |
| Reordenar colunas | arraste do cabeçalho, disponível para qualquer papel (backend recusa vendedor) | — |
| "O que precisa ser feito agora?" | **não respondido**: o card não mostra próxima tarefa, atraso nem último contato como alerta; a cadência automática existe só na prospecção interna da GSM | — |

---

## 11. Tasks / Reminders

| Capacidade | Estado | Evidência |
|---|---|---|
| Criar | PARTIAL | formulário inline: lead (select com **só os 200 primeiros leads**), título, prioridade, data/hora |
| Editar / reagendar | MISSING | só alternar concluída e excluir |
| Concluir | PARTIAL | toggle ☐/☑; sem registrar quem/quando |
| Excluir | PARTIAL | **sem confirmação** |
| Atrasadas / hoje | MISSING | lista única ordenada por vencimento, sem destaque de atraso nem filtros |
| Vínculo com lead | EXISTS (obrigatório); sem link para abrir o lead |
| Responsável | MISSING | (backend também não tem) |
| Data/hora | PARTIAL | `datetime-local` → `new Date(v).toISOString()` usa o fuso **do navegador**; a lista exibe só dia/mês (`shortDateLabel`), **sem hora** |
| Lembretes / notificações | MISSING | sem backend (BE P2-08) |
| Tratamento de erro | ✘ `handleCreate`, `handleToggle` e `handleDelete` sem try/catch → falha silenciosa | `TasksPage.tsx` |
| Agenda | PARTIAL, mesmos padrões: criar/listar/excluir, sem editar, sem tratamento de erro | `AgendaPage.tsx` |

---

## 12. Dashboard

Endpoint: `GET /api/v1/dashboard?date_from&date_to` (sem `pipeline_id` → sempre o pipeline default; **não há seletor de pipeline**). Estados: loading "Carregando…" ✔, erro `EmptyState` com a mensagem da API ✔, vazio → KPIs zerados sem orientação.

| Indicador | Finalidade | Filtros | Interpretação / problema |
|---|---|---|---|
| Total de leads | volume | período (criação) | ok |
| Leads hoje / Na semana / No mês | entrada recente | ignora o filtro de período (calculado no backend em UTC) | "hoje" pode divergir do horário local à noite (BE P2-07) |
| Clientes fechados | ganhos | período (criação do lead) | é "leads criados no período que hoje estão em Ganho", não "vendas fechadas no período" |
| Taxa de conversão | eficiência | idem | **ganhos ÷ total** (inclui abertos); o hint diz "ganhos / total" — ok, mas raramente é o que o cliente espera |
| Receita prevista | forecast | idem | valor × probabilidade dos abertos |
| Receita fechada | resultado | idem | soma do **valor esperado** dos ganhos, não valor real fechado |
| **1º atendimento** | tempo de resposta | — | **valor fictício: sempre 0 min** (`AVG_FIRST_CONTACT_HOURS_PLACEHOLDER = 0`, `DashboardApiRepository.ts`). O cliente vai ler como "atendimento instantâneo" |
| Até fechamento | ciclo | — | baseado em `last_interaction_at`/`updated_at` (impreciso — BE P2-07) |
| Em aberto / Perdidos | status | idem | "Perdidos — no período" = leads criados no período hoje perdidos |
| Leads por dia (7 dias) | tendência | fixo 7 dias | ok |
| Origem (donut) | canal | período | ok |
| Funil | distribuição por estágio | período | mostra os estágios **reais** (diferente do quadro) — o dashboard e o Pipeline mostram funis diferentes para o mesmo pipeline customizado |

**Visão de staff:** quando `isPlatformStaff`, aparecem os filtros "Ativo (prospecção) / Passivo (leads)" e o dashboard de prospecção GSM (`ProspectDashboardSection`). Faz sentido para a GSM, não para cliente — e depende de um flag editável no `localStorage` (os dados, porém, são protegidos pelo backend).

**Relatórios (`/relatorios`):** sem filtros (período, pipeline, dono); sempre o pipeline default.

---

## 13. Integrations / API UX

**Estado: MISSING.** Não existe tela, rota, hook, serviço ou tipo relacionado a API Keys, credenciais, scopes, webhooks ou integrações (grep por `api-keys`, `apiKey`, `webhook`: vazio).

| Elemento desejado | Estado | Observação cruzada com o backend |
|---|---|---|
| Configurações → Integrações → API | MISSING | backend tem `POST/GET/DELETE /accounts/{a}/tenants/{t}/api-keys`, mas exige **AccountMembership OWNER/ADMIN** — um admin de tenant cliente não teria acesso (BE P2-14) |
| Criar credencial (nome) | MISSING | backend aceita `name` + `environment` |
| Client ID / API key | MISSING | backend: `key_prefix` (`gsmk_prod_…`) |
| Secret mostrado uma vez | MISSING | backend devolve `full_key` só na criação ✔ |
| Scopes selecionáveis | MISSING | backend: scope fixo `leads:write` |
| Criado por / em, último uso, expiração, status | MISSING | backend expõe esses campos ✔ (expiração não é configurável) |
| Rotacionar | MISSING | backend não tem |
| Revogar | MISSING | backend tem |
| Excluir | MISSING | backend não tem (revogar = soft) |
| Documentação/snippet de uso | MISSING | — |

### UX recomendada para usuário não técnico (conceito)

```
Configurações → Integrações
┌──────────────────────────────────────────────────────────────┐
│ Como seus leads chegam ao CRM                                │
│  [Formulário do site]   [Landing page]   [WhatsApp]          │
│  [Instagram]            [n8n / Make / Zapier]  [API própria] │
└──────────────────────────────────────────────────────────────┘
Cada cartão abre um assistente:
 1. "Dê um nome"         (ex.: Instagram — Anúncios)
 2. "Onde o lead cai"    (pipeline + etapa + responsável padrão)
 3. "Conecte"            → gera a credencial (secret uma vez, botão Copiar)
                         → mostra o que colar no n8n/site (URL + header),
                           com exemplo pronto e botão "Enviar lead de teste"
 4. "Pronto"             → status: Aguardando 1º lead / Recebendo / Erro
Instagram/WhatsApp aparecem como "via automação (n8n/Meta)" — não
prometer integração nativa. Detalhes técnicos (scopes, rotação,
webhooks de saída) ficam em "Avançado → Desenvolvedores/API".
Lista de integrações: nome, origem, leads recebidos (7 dias), último
recebimento, status, [Pausar] [Rotacionar] [Revogar].
```

---

## 14. Onboarding

Simulação: admin do cliente recebe e-mail e senha temporária por fora.

| Momento | O que acontece | Avaliação |
|---|---|---|
| 1º login | tela "Entrar — Acesse o painel da sua empresa"; com senha temporária → `/trocar-senha` (✔ o frontend obriga a troca) | ✔ |
| Após trocar | cai em `/dashboard` com **12 KPIs zerados**, gráfico vazio, sem mensagem de boas-vindas | ✘ |
| Primeiro pipeline | o backend semeia estágios padrão; se não houver pipeline, "Nenhum pipeline cadastrado ainda — crie em Configurações" | ◐ |
| Primeiro lead | botão "+ Novo lead" ✔; sem explicação de origem/responsável | ◐ |
| Primeiro usuário | formulário com senha temporária visível e texto técnico sobre "o backend" | ✘ |
| Primeira tarefa | precisa ir em `/tarefas` e escolher o lead numa lista | ◐ |
| Integração | inexistente | ✘ |
| Checklist / tour / ajuda contextual | MISSING | ✘ |
| Nomenclatura do tenant | se `GET /auth/tenants` falhar, a topbar mostra o **UUID** do tenant | ✘ |

**Onde é necessário treinamento humano hoje:** entender "Passivo/Ativo" (se a pessoa for staff), por que a busca da topbar não funciona, como mover um lead pelo celular (não dá), o que significa "1º atendimento 0min", como criar colegas e repassar a senha, como conectar formulários/automações (sem UI — precisa da GSM), o que fazer se o funil tiver mais etapas.

---

## 15. UI States

| Estado | Situação | Evidência |
|---|---|---|
| LOADING | texto "Carregando…"; `ProtectedRoute` renderiza `null` (tela em branco) enquanto `loading` | `ProtectedRoute.tsx` |
| EMPTY | frases curtas ("Nenhum lead encontrado.", "Nenhuma tarefa por aqui.") sem CTA | páginas |
| SUCCESS | toast verde com "✓" | `ToastHost.tsx` |
| ERROR | `EmptyState` com a mensagem da API; **toasts de erro também usam "✓" verde** | `ToastHost.tsx` (ícone fixo) |
| FORBIDDEN | sem tela própria; 403 aparece como erro genérico da seção ("Não foi possível carregar…" + "Você não tem permissão…") | — |
| OFFLINE / rede | `fetch` rejeita com `TypeError` → mensagem crua do navegador ("Failed to fetch") | `ApiClient.rawRequest` |
| Tela branca | qualquer exceção de render derruba o app inteiro (sem error boundary) | grep vazio |
| Botão sem feedback | Tarefas, Agenda, Pipeline (mover), Usuários (criar) sem `catch` | §11, §10, §6 |
| Double submit | ✔ na maioria (botão desabilitado durante `submitting`); ✘ Tarefas/Agenda não desabilitam durante envio | `TasksPage` |
| Ação sem confirmação | excluir tarefa, excluir compromisso, mover para Ganho/Perdido | páginas |
| Formulário perdendo dados | fechar drawer/modal clicando fora descarta a edição sem aviso | `LeadDrawer` overlay `onClick={onClose}` |
| Erro técnico ao usuário | mensagens do backend chegam cruas (ex.: `Lead <uuid> não encontrado`); 422 de validação Pydantic vira "Erro ao comunicar com o servidor." (detalhe é lista, não string) | `ApiClient.readErrorDetail` |

---

## 16. Forms

| Item | Situação |
|---|---|
| Validação | mínima: nome obrigatório, senha ≥ 8; e-mail sem validação nos formulários de lead/usuário (o login usa `type="email"`) |
| Campos obrigatórios | sem marcação visual (`*`); botão só fica desabilitado |
| Mensagens | via toast (que some em 3,2 s e usa "✓") |
| Submit / loading | "Salvando…" em lead/drawer; ausente em tarefas/agenda/usuários |
| Duplicate submit | ver §15 |
| Erros de API | 422 do FastAPI (lista) vira mensagem genérica; `ConflictError` aparece bem (string) |
| Máscara de telefone | `formatPhone` (padrão BR) ✔; sem DDI internacional |
| Moeda | `CurrencyInput` ✔ |
| Datas | `datetime-local` + fuso do navegador; exibição sem hora em tarefas |
| Timezone | não há conceito de fuso da organização (BE P3-06) |
| Labels | `<label>` sem `htmlFor`/`id` em Login e vários formulários; formulários de Usuários e Tarefas usam só `placeholder` |
| Senha temporária | campo `type="text"` e senha repetida em toast (`UsersPage`) |

---

## 17. Mobile

Há tratamento responsivo (sidebar vira drawer com overlay e Esc; 11 dos 39 arquivos CSS têm `@media`).

| Tela | Situação | Bloqueia operação? |
|---|---|---|
| Sidebar | drawer off-canvas ✔ | não |
| Dashboard | grids de KPI (verificar quebra em telas estreitas — NOT_VERIFIABLE sem navegador) | não |
| Tabela de leads | `overflow-x: auto` ✔ | não |
| Lead drawer | abre, edita, comenta ✔; **sem seletor de etapa** | parcialmente |
| **Pipeline** | scroll horizontal ✔; **drag-and-drop HTML5 não funciona em toque** (nenhum handler `touch/pointer`) | **sim — impossível mover lead pelo celular** |
| Formulários | inputs sem `inputmode`/`autocomplete` (teclado numérico no telefone não sobe) | não |
| Modais | overlay em tela cheia; sem trava de scroll do fundo | não |
| Tarefas | formulário inline com 5 campos lado a lado (depende de CSS; NOT_VERIFIABLE) | possível |
| Painel Terapeuta da Vez | layout de quiosque (fora do escopo do CRM) | — |

---

## 18. Accessibility

Bloqueadores reais (não é auditoria WCAG completa):

| Problema | Evidência | Impacto |
|---|---|---|
| Nenhum modal/drawer com `role="dialog"`, `aria-modal`, foco inicial ou trap de foco | grep `role="dialog"`/`aria-modal`: 0 | leitor de tela e teclado se perdem |
| Kanban só por mouse (drag-and-drop) | `PipelinePage` | teclado não move leads |
| Linhas de tabela clicáveis sem foco (`<tr onClick>`) | `LeadRow`, `ProspectsTable` | teclado não abre lead |
| Labels não associados a inputs; formulários só com placeholder | `LoginPage.tsx:86,94`, `UsersPage`, `TasksPage` | leitor de tela não anuncia campos |
| Toast sem `aria-live` | `ToastHost.tsx` | erros/sucessos não são anunciados |
| Botões de ícone | ✔ maioria com `aria-label` (fechar, sair, concluir tarefa) | — |
| Contraste | tema claro/escuro por tokens; NOT_VERIFIABLE sem ferramenta | — |
| Idioma | `<html lang="pt-BR">` ✔ | — |

---

## 19. Frontend Security

| Item | Situação | Severidade |
|---|---|---|
| Armazenamento de tokens | access **e refresh** em `localStorage` (`gsm_crm_session`) — qualquer XSS, extensão maliciosa ou acesso físico leva um refresh válido por 30 dias (e, com BE P0-03, irrevogável) | P1 |
| Dados de autorização no storage | `role` e `isPlatformStaff` lidos do `localStorage` e nunca revalidados | P1 (UI), sem impacto de dados graças ao backend |
| Senha do painel de operações | `sessionStorage` | informativo (módulo deve sair do produto) |
| XSS | ✔ nenhum `dangerouslySetInnerHTML`, `innerHTML` ou `eval`; React escapa o conteúdo | — |
| Secrets no bundle | nenhum secret de servidor; ⚠ o bundle de produção contém as **credenciais do modo demo** (`admin@gsmautomacao…`/`demodemo`) e o nome do header `X-Operations-Password` | P2 |
| Env vars | só `VITE_CRM_API_URL` e `VITE_CRM_MODE`; fallback `http://localhost:8010` embutido | P3 |
| **Modo demo por padrão** | sem `VITE_CRM_MODE`, qualquer hostname que **não** comece com `crm.` cai em **demo** (dados fictícios, auto-login, botões "Admin GSM") — ex.: `app.cliente.com.br` | P1 |
| `console.log` | ✔ nenhum | — |
| Source maps | ✔ não gerados (build padrão do Vite) | — |
| Headers HTTP do host | `vercel.json` só tem rewrite: **sem CSP, X-Frame-Options/frame-ancestors, HSTS explícito, Referrer-Policy** → clickjacking possível; script inline no `index.html` dificulta CSP estrita | P2 |
| Fontes externas | Google Fonts carregadas de terceiros (IP do usuário enviado ao Google — ponto de LGPD/privacidade) | P3 |
| Autorização presumida | a UI supõe que esconder o menu basta para SDR/Clientes/Usuários | P1 (§7, §8) |

---

## 20. Tenant Isolation (UI)

| Verificação | Resultado |
|---|---|
| `tenant_id` / `organization_id` enviado manualmente em requisições | **Não encontrado.** Nenhum repositório API envia `tenant_id` no body/query; é só **lido** das respostas (`dto.tenant_id`) |
| Onde o frontend escolhe tenant | (1) tela pós-login quando há 2+ tenants; (2) seletor na topbar (`canSwitchRealTenant`). Os dois chamam `POST /auth/select-tenant` (o backend revalida a membership) e recarregam a página inteira (`window.location.assign`), limpando dados em memória ✔ |
| Usuário normal com 1 tenant | não vê seletor ✔ |
| Cache entre tenants | não há cache persistente de dados; troca de tenant faz reload ✔ |
| `accountId` | guardado mas não usado para autorizar ✔ |
| Dependências perigosas do backend | (a) `select-tenant` com refresh token — **o frontend usa esse caminho para trocar de tenant**; a correção do BE P0-03 precisa manter o fluxo funcionando; (b) o isolamento de dados depende 100% de RLS + filtros do backend (correto); (c) o frontend envia `owner_id`, `pipeline_id`, `stage_id` e `tag_ids` como UUIDs — o backend valida todos, **exceto `tag_ids`** (BE P2-02) |

---

## 21. Error Handling

`ApiClient.apiRequest`: em 401 tenta **um** refresh; se falhar, chama `onSessionExpired` (limpa a sessão → redireciona para login via `ProtectedRoute`). Nos demais casos lança `ApiError(status, detail)` com `detail` **apenas se for string**.

| Status | Comportamento atual | Adequado? |
|---|---|---|
| 400 | mensagem do backend (ex.: `DomainError`) | ◐ texto técnico às vezes |
| 401 | refresh → retry; falha = logout silencioso (sem aviso "sessão expirou") | ◐ |
| 403 | "Você não tem permissão para executar esta ação" | ✔ texto, ✘ toast com "✓" |
| 404 | ex.: "Lead 3f2a… não encontrado" | ◐ expõe UUID |
| 409 | mensagem de conflito (ex.: e-mail já existe) | ✔ |
| 422 | detail é **lista** (Pydantic) → "Erro ao comunicar com o servidor." | ✘ perde o motivo |
| 429 | mensagem do backend; `Retry-After` ignorado | ◐ |
| 500 | "Erro interno do servidor" (backend já esconde stack) | ◐ sem orientação |
| 503 | "Banco de dados indisponível"/"serviço indisponível" cru | ◐ |
| Rede | "Failed to fetch" (inglês, cru) | ✘ |

Não foram encontrados "IntegrityError" ou stack trace na UI — o backend já os converte em 500 genérico. Mas excluir pipeline/estágio com leads (BE P2-11) vira "Erro interno do servidor" sem explicação.

**Condição de corrida no refresh (P1-01):** o `tryRefresh` não é compartilhado entre requisições. Telas como Pipeline disparam várias chamadas ao mesmo tempo; com o access token vencido, todas recebem 401 e todas tentam renovar com o mesmo refresh token. O backend rotaciona no primeiro uso, as demais recebem 401 → `onSessionExpired` → **logout**. Além disso, os tokens renovados **não são gravados** no `localStorage` (`tryRefresh` só atualiza variáveis do módulo), então um F5 depois de uma renovação tenta um refresh já revogado → logout.

---

## 22. Commercial UX

**Avaliação: (A) ferramenta interna da GSM com uma camada de produto em construção.** Evidências:

| Evidência | Onde |
|---|---|
| Texto de desenvolvedor visível ao cliente: "O backend não tem convite por e-mail nem reset de senha ainda…" | `UsersPage.tsx` |
| KPI fictício (1º atendimento = 0 min), seções vazias por design (Timeline, Tarefas no drawer, IA) | `DashboardApiRepository`, `LeadDrawer` |
| Busca global da topbar sem função; "+ Lead" só navega | `AppLayout.tsx` |
| Funil fixo de 5 colunas herdado do protótipo | `stageMapping.ts` |
| Nomenclatura interna misturada ("Passivo (leads)", "Ativo (prospecção)", "Prospecção GSM") para staff | Dashboard/Pipeline/Leads/Settings |
| App serve também o painel de um cliente específico (Terapeuta da Vez) | rotas |
| Papel exibido cru ("admin"), UUID do tenant como nome de fallback | `AppLayout`, `ProfilePage`, `AuthProvider` |
| Modo demo com botões "Entrar (Empresa)"/"Admin GSM" ativado por hostname | `LoginPage`, `factory.ts` |
| Sem onboarding, ajuda, página de erro, 404 amigável (rota desconhecida vai para o dashboard em silêncio) | `routes/index.tsx` |
| Consistência visual boa (tokens de tema, dark mode, componentes comuns) | `styles/theme.css` |

---

## 23. Branding

Informativo — não é, por si só, um problema.

| Local | Conteúdo | Hardcoded? |
|---|---|---|
| `<title>` | "GSM CRM" | sim (`index.html`) |
| Favicon / apple-touch-icon | ícones GSM | sim (`public/`) |
| Logo sidebar e login | `<GSM />` + "CRM" em texto/CSS | sim (`AppLayout.tsx:156`, `AuthLayout.tsx:10`) |
| Rodapé do login | "© 2026 GSM Automação · gsmautomacao.com.br" | sim (`AuthLayout.tsx:30`) |
| E-mails de demo | `@gsmautomacao.com.br` | sim (modo demo) |
| Cores / fontes | tokens CSS + Google Fonts (Sora, Space Grotesk, JetBrains Mono) | sim, centralizado em `theme.css` |
| Nome/logo do cliente | só o nome do tenant na topbar (avatar com iniciais) | — |

Conclusão: a marca é "GSM CRM" com o cliente como inquilino. Isso é coerente com "CRM entregue pela GSM". White-label exigiria centralizar título, logo, favicon e rodapé em configuração por tenant (P3).

---

## 24. Performance

| Risco | Evidência | Severidade |
|---|---|---|
| Bundle único de **760 KB** (204 KB gzip) com SDR, operações, prospecção e mocks; aviso do Vite para chunks > 500 KB | build | P2 |
| Sem code-splitting / lazy routes | `routes/index.tsx` | P2 |
| Busca sem debounce (1 request por tecla) | `LeadsPage` | P2 |
| `useAsyncResource` sem cache/dedupe: cada tela recarrega tudo; hooks iguais em componentes diferentes duplicam requests (ex.: `useLeads` em Tarefas e Pipeline) | `useAsyncResource.ts` | P3 |
| Pipelines: 1 request de estágios **por pipeline** a cada listagem (N+1) | `PipelinesApiRepository.toPipeline` | P3 |
| Mover lead faz GET + PATCH | `LeadsApiRepository.move` | P3 |
| Limites fixos 100/200 escondem dados em vez de paginar | Leads, Pipeline, Tarefas | P1 (funcional) |
| Polling | só SDR (3 s, para quando termina) e painel do quiosque — aceitável | — |
| Charts | CSS puro, leves | — |
| Imagens | nenhuma relevante | — |

---

## 25. Tests / Build

| Verificação | Comando | Resultado |
|---|---|---|
| Lint | `npx eslint .` | ✔ **sem erros nem avisos** |
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit` | ✔ **sem erros** |
| Build | `npx vite build` (saída numa pasta temporária fora do projeto) | ✔ 290 módulos, 1,7 s; ⚠ chunk JS de 760 KB (> 500 KB) |
| Testes | — | **MISSING**: não há script `test`, framework (Vitest/Jest/Playwright) nem arquivos de teste |
| Source maps no build | — | não gerados ✔ |

Nenhum arquivo do projeto foi modificado pelos comandos (`git status` limpo, exceto este relatório).

---

## 26. Backend Contracts To Verify

| # | Contrato | Por que importa para o frontend | Referência |
|---|---|---|---|
| 1 | Todas as rotas `/sdr/*`, `/prospects/*`, `/clients/*` retornam 403 para não-staff | a UI não tem guard de rota | BE §6 ✔ verificado |
| 2 | `select-tenant` com `refresh_token` passará a validar revogação e `is_active` **sem quebrar** a troca de tenant da topbar | o frontend depende desse caminho | BE P0-03 |
| 3 | `/auth/refresh`: rotação com detecção de reuso — definir se reuso concorrente (várias abas/requests) derruba a família | com detecção de reuso, a corrida do P1-01 vai deslogar ainda mais | BE §7 |
| 4 | `/auth/me` deve ser a fonte de `role`/`isPlatformStaff` em cada carga do app | hoje o frontend confia no storage | — |
| 5 | Semântica de estágios: N estágios livres por pipeline, `is_won`/`is_lost` múltiplos permitidos? | o frontend precisa renderizar o funil real | BE §9 |
| 6 | `GET /leads`: paginação real (`page`, `page_size ≤ 1000`, `total`) e filtros `owner_id`, `origin`, `stage_id`, `date_*` | a UI precisa paginar e filtrar | BE §9 |
| 7 | Filtro de leads "sem responsável" e "minhas" | intake público cria leads sem dono | BE §9 |
| 8 | `DELETE /leads/{id}` — política por papel (vendedor pode?) | a UI não oferece exclusão | BE §8 |
| 9 | `POST /users` só admin; endpoints futuros de editar/desativar/mudar papel | o gestor vê o formulário hoje | BE P1-02 |
| 10 | Dashboard: métricas por eventos, fuso do tenant, `pipeline_id`, owner/origin; campo de 1º atendimento | KPI fictício e interpretação | BE P2-07 |
| 11 | Reordenar estágios (`/stages/reorder`) só admin/gestor | a UI permite a vendedor | BE §8 |
| 12 | `tag_ids` validados por tenant | a UI envia UUIDs de tags | BE P2-02 |
| 13 | Tarefas: responsável, edição, `completed_at`, filtros hoje/atrasadas, endpoint paginado | a tela precisa disso | BE §10 |
| 14 | API Keys gerenciáveis pelo **admin do tenant** (não só account owner), scopes, rotação, expiração | a tela de integrações depende disso | BE §13 |
| 15 | Formato de erro de validação (422) — lista de campos padronizada | a UI mostra mensagem genérica hoje | BE §12 |
| 16 | Excluir pipeline/estágio com leads → 409 com mensagem, não 500 | a UI mostra "Erro interno" | BE P2-11 |
| 17 | Rotas de plataforma para a futura UI de Super Admin (orgs CRUD, status, impersonation revogável, audit) | a UI não existe | BE P1-03/P1-04 |
| 18 | CORS em produção só com os domínios do frontend | o frontend chama a API cross-origin | BE §16 |
| 19 | Módulo `operations` / `terapeuta-da-vez` fora do SaaS ou tenant-scoped | a UI pública depende disso | BE P0-01/P0-02 |
| 20 | Status de tenant suspenso: resposta padronizada (ex.: 403 com código) para a UI mostrar "conta suspensa" | a UI hoje só verá erro genérico | BE P1-04/P1-06 |

---

## 27. P0 Findings — BLOQUEIA VENDA

### FE-P0-01 · PIPELINE / CRM · A UI não representa o pipeline real do backend
- **Arquivos:** `src/repositories/api/stageMapping.ts` (`buildStageMap`), `src/repositories/api/PipelinesApiRepository.ts` (`toPipeline`, `createStage` retorna `id: "novo"`), `src/constants/stages.ts`, `src/components/leads/LeadDrawer.tsx` (`STAGES[lead.stage]`), `src/repositories/api/LeadsApiRepository.ts` (`move`, `toLead.stage`).
- **Comportamento:** todo pipeline vira 5 colunas fixas. Com mais de 3 etapas intermediárias, as excedentes são fundidas em "Proposta"; com menos, aparece coluna "fantasma" com rótulo cru. O drawer mostra o rótulo fixo ("Proposta"), não o nome real. Estágio desconhecido vira "novo".
- **Impacto:** o cliente configura o funil e vê outro; leads parecem estar na etapa errada e, ao arrastar, **vão para a etapa errada** (corrupção de dados via UI). O dashboard mostra o funil real, e o quadro mostra outro. Hoje só o pipeline padrão (3 intermediárias + ganho + perdido) funciona.
- **Recomendação:** o quadro e o drawer devem usar os estágios reais (UUID, nome, cor, ordem) em vez de `StageKey`.

### FE-P0-02 · SECURITY / MULTI_TENANCY · Painel "Terapeuta da Vez" público servido pelo app do CRM
- **Arquivos:** `src/routes/index.tsx` (rotas fora de `ProtectedRoute`), `src/pages/TerapeutaDaVezPage.tsx`, `TerapeutaDaVezGestaoPage.tsx`, `src/repositories/api/TerapeutaDaVezPublicRepository.ts`, `operationsAuth.ts`.
- **Comportamento:** qualquer pessoa acessa `/terapeuta-da-vez` no domínio do CRM; a gestão usa uma senha compartilhada; o bundle de todo cliente contém esses endpoints.
- **Impacto:** é a porta de entrada visível do BE P0-01/P0-02 (PII de clientes finais sem autenticação). Um produto SaaS não pode servir o painel público de um cliente específico no mesmo app.
- **Recomendação:** retirar do app do CRM (deploy próprio) junto com a correção do backend.

---

## 28. P1 Findings — ANTES DO PRIMEIRO CLIENTE

| ID | Cat. | Achado | Evidência |
|---|---|---|---|
| FE-P1-01 | AUTH | Logout involuntário: tokens renovados não são persistidos e várias requisições concorrentes disputam o refresh (rotação invalida as demais) | `ApiClient.tryRefresh`, `AuthProvider` |
| FE-P1-02 | SECURITY/AUTH | Access e refresh token em `localStorage`; `role`/`isPlatformStaff` lidos do storage e nunca revalidados via `/auth/me` | `AuthProvider.loadStoredSession` |
| FE-P1-03 | RBAC | Nenhum guard de rota por papel: SDR, Clientes, Usuários e Configurações abrem por URL; gestor vê "criar usuário" (backend só admin); vendedor pode reordenar colunas; staff sem `sdr_admin` vê CRUD SDR | `routes/index.tsx`, `AppLayout.tsx:112` |
| FE-P1-04 | PRODUCT | Área de Super Admin inexistente (organizações, status, impersonation, auditoria, API Keys) | grep `/platform`: 0 |
| FE-P1-05 | PRODUCT/RBAC | Gestão de equipe incompleta: só criar; senha temporária visível e repetida no toast; campo "Time" falso; texto técnico sobre "o backend"; sem editar/desativar/papel | `UsersPage.tsx` |
| FE-P1-06 | LEADS | Tabela limitada a 100 leads sem paginação nem filtros; `/leads/:id` falha fora dos 100; sem responsável (exibir/atribuir); sem excluir; sem mudar etapa no drawer; seções vazias por design (Timeline, Tarefas, IA) | `LeadsPage.tsx`, `LeadDrawer.tsx`, `toLead` |
| FE-P1-07 | UX | Erros silenciosos ou disfarçados: toast sempre com "✓"; ações sem `catch` (tarefas, agenda, mover lead, criar usuário); sem error boundary (tela branca); "Failed to fetch"; 422 genérico | `ToastHost.tsx`, `TasksPage`, `AgendaPage`, `PipelinePage.handleDrop`, `ApiClient` |
| FE-P1-08 | SECURITY/PRODUCT | Modo demo ativado por padrão em qualquer hostname que não comece com `crm.` sem `VITE_CRM_MODE` (dados fictícios + botões "Admin GSM") | `services/factory.ts` `resolveMode` |
| FE-P1-09 | DASHBOARD | KPI "1º atendimento" fictício (sempre 0); sem seletor de pipeline; métricas herdam a semântica ambígua do backend | `DashboardApiRepository.ts` |
| FE-P1-10 | MOBILE/PIPELINE | Impossível mover lead pelo celular (DnD HTML5 sem toque; sem seletor de etapa no drawer); sem alternativa por teclado | `PipelinePage.tsx`, `LeadDrawer.tsx` |
| FE-P1-11 | PRODUCT | Ferramentas internas GSM no mesmo app e bundle (SDR, prospecção, clientes, credenciais demo); UI "Ativo/Passivo" misturada às telas do cliente para staff | build, `DashboardPage`, `PipelinePage`, `LeadsPage`, `SettingsPage` |
| FE-P1-12 | TASKS | Tarefas sem editar/reagendar, sem hoje/atrasadas, sem hora na lista, lead limitado a 200 opções, exclusão sem confirmação, sem responsável | `TasksPage.tsx` |
| FE-P1-13 | PRODUCT | Onboarding inexistente: dashboard zerado sem orientação, sem checklist, UUID do tenant como nome de fallback, busca global morta | §14, `AppLayout.tsx` |

---

## 29. P2 Findings — PÓS-LANÇAMENTO PRÓXIMO

| ID | Cat. | Achado | Evidência |
|---|---|---|---|
| FE-P2-01 | INTEGRATIONS/API | Nenhuma UI de integrações/credenciais/webhooks | §13 |
| FE-P2-02 | ACCESSIBILITY | Modais sem `role="dialog"`/foco; labels sem associação; toast sem `aria-live`; linhas clicáveis sem foco | §18 |
| FE-P2-03 | SECURITY | `vercel.json` sem CSP/frame-ancestors/Referrer-Policy (clickjacking); script inline | `vercel.json`, `index.html` |
| FE-P2-04 | PERFORMANCE | Bundle único de 760 KB; sem lazy/code-splitting; código interno enviado a todos | build |
| FE-P2-05 | PERFORMANCE/LEADS | Busca sem debounce | `LeadsPage` |
| FE-P2-06 | PIPELINE | Sem optimistic update/rollback; mover = GET+PATCH; limite silencioso de 200 cards; sem filtros de dono/origem/tag; card não mostra próxima ação/atraso | `PipelinePage.tsx` |
| FE-P2-07 | UX | Sem confirmação em exclusões e em mover para Ganho/Perdido; clicar fora descarta edição | páginas |
| FE-P2-08 | UX | Papel cru ("admin"), mensagens de erro com UUID, 404 de rota redireciona para dashboard sem aviso | `AppLayout`, `ProfilePage`, `routes` |
| FE-P2-09 | DASHBOARD | Relatórios sem filtros (período, pipeline, dono) | `ReportsPage.tsx` |
| FE-P2-10 | PRODUCT | Configurações da organização (nome, fuso, logo) inexistentes; sem excluir pipeline/tag na UI | `SettingsPage.tsx` |
| FE-P2-11 | UX | Formulários sem marcação de obrigatório, validação de e-mail, `inputmode`/`autocomplete` | §16 |
| FE-P2-12 | SECURITY | Credenciais do modo demo e nome do header de operações no bundle de produção | build |
| FE-P2-13 | QUALITY | Sem testes automatizados (unit/e2e) | `package.json` |
| FE-P2-14 | AUTH | Sessão expirada sem aviso ("sua sessão expirou"); `Retry-After` do 429 ignorado | `ApiClient` |

---

## 30. P3 Findings — EVOLUÇÃO

| ID | Cat. | Achado |
|---|---|---|
| FE-P3-01 | PERFORMANCE | Camada de dados sem cache/dedupe (considerar TanStack Query ou similar) |
| FE-P3-02 | PERFORMANCE | N+1 de estágios por pipeline |
| FE-P3-03 | PRODUCT | White-label (título, logo, favicon, rodapé por tenant) |
| FE-P3-04 | SECURITY | Google Fonts externas (privacidade/LGPD e performance) — self-host |
| FE-P3-05 | PRODUCT | Módulo de permissões centralizado (`can(permission)`) no lugar de comparações de string |
| FE-P3-06 | PRODUCT | Fuso por organização; telefone internacional |
| FE-P3-07 | UX | Toasts tipados (sucesso/erro/aviso) com duração e ação |
| FE-P3-08 | PRODUCT | Remover o código de mock/demo do bundle de produção (build separado de demo) |

---

## 31. Missing Capabilities

1. Área de Super Admin (organizações, status, usuários, features, uso, saúde, impersonation, auditoria).
2. Guard de rota por papel/escopo e fonte de verdade de permissões via `/auth/me`.
3. Gestão de equipe (convite, editar, desativar, papel, reenviar acesso).
4. Pipeline dinâmico (N estágios reais) e mudança de etapa fora do drag-and-drop.
5. Paginação e filtros de leads; responsável; exclusão/arquivamento; histórico/timeline.
6. Tarefas com edição, responsável, hoje/atrasadas, lembretes.
7. Integrações/API (credenciais, assistentes por canal, webhooks, lead de teste).
8. Onboarding (boas-vindas, checklist, empty states com CTA, ajuda).
9. Configurações da organização.
10. Error boundary, telas de 403/404/offline, toasts por tipo.
11. Testes automatizados.
12. Bundle separado para ferramentas internas e para o modo demo.

---

## 32. Commercial Readiness Checklist

| # | Item | Status |
|---|---|---|
| 1 | Pipeline configurado pelo cliente aparece igual no quadro | ✘ (FE-P0-01) |
| 2 | Nenhuma tela pública/interna de outro cliente no mesmo app | ✘ (FE-P0-02) |
| 3 | Sessão estável (sem logout aleatório) | ✘ (FE-P1-01) |
| 4 | Rotas internas protegidas por guard + backend | ◐ backend sim, guard não (FE-P1-03) |
| 5 | Código interno GSM fora do bundle do cliente | ✘ (FE-P1-11) |
| 6 | Admin do cliente gerencia a equipe | ✘ (FE-P1-05) |
| 7 | GSM administra organizações pela UI | ✘ (FE-P1-04) |
| 8 | Leads paginados, filtráveis, com responsável | ✘ (FE-P1-06) |
| 9 | Erros claros e nunca disfarçados de sucesso | ✘ (FE-P1-07) |
| 10 | Deploy nunca cai em modo demo por acidente | ✘ (FE-P1-08) — NOT_VERIFIABLE se `VITE_CRM_MODE` está setado na Vercel |
| 11 | Dashboard sem métricas fictícias | ✘ (FE-P1-09) |
| 12 | Operação básica pelo celular | ✘ (FE-P1-10) |
| 13 | Tarefas utilizáveis como follow-up | ◐ (FE-P1-12) |
| 14 | Primeiro acesso autoexplicativo | ✘ (FE-P1-13) |
| 15 | Tenant nunca escolhido manualmente fora de `select-tenant` | ✔ |
| 16 | Sem XSS sinks, secrets de servidor, logs ou source maps | ✔ |
| 17 | Lint, typecheck e build verdes | ✔ |
| 18 | Troca de senha obrigatória no primeiro acesso | ✔ |
| 19 | Integrações/API para o cliente | ✘ (FE-P2-01) |
| 20 | Acessibilidade básica (teclado/leitor de tela) | ✘ (FE-P2-02) |

---

## 33. Recommended Roadmap

**Fase 0 — Contenção (junto com a Fase 0 do backend)**
1. FE-P0-02: tirar `/terapeuta-da-vez*` do app do CRM.
2. FE-P1-08: fixar `VITE_CRM_MODE=production` no deploy e fazer o fallback padrão ser produção, não demo.
3. FE-P1-01: refresh único compartilhado (single-flight) + persistir os tokens renovados.

**Fase 1 — Mínimo vendável**
4. FE-P0-01: pipeline dinâmico (estágios reais) + seletor de etapa no drawer (também resolve FE-P1-10).
5. FE-P1-03 / FE-P1-02: guards de rota por papel/escopo, `/auth/me` na carga, módulo de permissões.
6. FE-P1-07: error boundary, toast por tipo com `aria-live`, `catch` em todas as ações, tradução de 422/rede.
7. FE-P1-06 / FE-P1-12: paginação e filtros de leads, responsável, exclusão; tarefas com editar, hoje/atrasadas, hora.
8. FE-P1-05: gestão de equipe (depende de BE P1-02).
9. FE-P1-09: remover o KPI fictício; seletor de pipeline.
10. FE-P1-13: onboarding mínimo (boas-vindas + checklist + empty states com CTA).
11. FE-P1-11: lazy loading e chunk separado para SDR/prospecção/clientes (idealmente app interno separado).

**Fase 2 — Produto**
12. FE-P1-04: área de Super Admin (depende de BE P1-03/P1-04).
13. FE-P2-01: Integrações/API com assistentes por canal (depende de BE P2-14/P2-16).
14. FE-P2-02 acessibilidade, FE-P2-03 headers, FE-P2-04 performance, FE-P2-13 testes (Vitest + Playwright para login, pipeline e isolamento de rotas).

**Fase 3 — Maturidade**
15. White-label, cache de dados, fuso por organização, relatórios com filtros.

---

## Tabela consolidada de achados

| ID | Severidade | Categoria | Tela/Arquivo | Achado | Impacto | Recomendação |
|---|---|---|---|---|---|---|
| FE-P0-01 | P0 | PIPELINE/CRM | `stageMapping.ts`, `PipelinesApiRepository.ts`, `LeadDrawer.tsx` | Funil fixo de 5 colunas no lugar dos estágios reais | Leads exibidos/movidos para a etapa errada em funis customizados | Renderizar os estágios reais por UUID |
| FE-P0-02 | P0 | SECURITY/MULTI_TENANCY | `routes/index.tsx`, `TerapeutaDaVez*` | Painel público de cliente específico no app do CRM | Porta visível para PII sem auth (BE P0-01) | Remover do app / deploy próprio |
| FE-P1-01 | P1 | AUTH | `ApiClient.ts`, `AuthProvider.tsx` | Refresh concorrente e tokens renovados não persistidos | Logout aleatório | Single-flight + persistência |
| FE-P1-02 | P1 | SECURITY/AUTH | `AuthProvider.tsx` | Tokens e papéis em `localStorage`, sem revalidação | Roubo de sessão via XSS; UI com papel desatualizado | Revalidar `/auth/me`; avaliar cookie httpOnly |
| FE-P1-03 | P1 | RBAC | `routes/index.tsx`, `AppLayout.tsx` | Sem guard de rota; checagens de papel inconsistentes | Telas internas/indevidas por URL; ações que falham | Guards + módulo de permissões |
| FE-P1-04 | P1 | PRODUCT | — | Sem área de Super Admin | GSM administra via banco/CLI | UI de plataforma |
| FE-P1-05 | P1 | PRODUCT/RBAC | `UsersPage.tsx` | Só criar usuário; senha visível; texto técnico | Cliente não gerencia a equipe | Gestão completa de equipe |
| FE-P1-06 | P1 | LEADS | `LeadsPage.tsx`, `LeadDrawer.tsx` | 100 leads sem paginação/filtros; sem responsável/excluir; seções vazias | Dados "somem"; operação incompleta | Paginação, filtros, responsável |
| FE-P1-07 | P1 | UX | `ToastHost.tsx`, `TasksPage`, `AgendaPage`, `PipelinePage` | Erros com "✓", falhas silenciosas, sem error boundary | Usuário acha que salvou; tela branca | Tratamento de erro padronizado |
| FE-P1-08 | P1 | SECURITY/PRODUCT | `services/factory.ts` | Demo por padrão fora de `crm.*` | Cliente vê dados fictícios/botão "Admin GSM" | Default produção + env obrigatória |
| FE-P1-09 | P1 | DASHBOARD | `DashboardApiRepository.ts` | KPI de 1º atendimento sempre 0; sem seletor de pipeline | Decisão com número falso | Remover KPI até existir dado |
| FE-P1-10 | P1 | MOBILE/PIPELINE | `PipelinePage.tsx` | DnD sem toque; sem seletor de etapa | Não move lead no celular | Seletor de etapa + DnD com pointer events |
| FE-P1-11 | P1 | PRODUCT/SECURITY | build, páginas com `isPlatformStaff` | Ferramentas internas no mesmo app/bundle | Exposição de estrutura interna | Chunk/app separado |
| FE-P1-12 | P1 | TASKS | `TasksPage.tsx` | Sem editar, hoje/atrasadas, hora; limite 200 | Follow-up não confiável | Evoluir tela de tarefas |
| FE-P1-13 | P1 | PRODUCT | Dashboard, `AppLayout.tsx` | Sem onboarding; busca morta; UUID como nome | Exige treinamento humano | Onboarding mínimo |
| FE-P2-01 | P2 | INTEGRATIONS/API | — | Sem UI de integrações/API | Integração depende da GSM | Assistentes por canal |
| FE-P2-02 | P2 | ACCESSIBILITY | modais, formulários, toast | Sem dialog/foco/labels/aria-live | Inacessível a teclado/leitor | Correções básicas |
| FE-P2-03 | P2 | SECURITY | `vercel.json` | Sem CSP/frame-ancestors | Clickjacking | Headers de segurança |
| FE-P2-04 | P2 | PERFORMANCE | build | Chunk único de 760 KB | Carga inicial lenta no celular | Lazy/code-splitting |
| FE-P2-05 | P2 | PERFORMANCE | `LeadsPage.tsx` | Busca sem debounce | Carga no backend | Debounce |
| FE-P2-06 | P2 | PIPELINE | `PipelinePage.tsx` | Sem otimismo/rollback; limite 200 silencioso; sem filtros | UX lenta e incompleta | Otimismo + filtros |
| FE-P2-07 | P2 | UX | páginas | Sem confirmações; edição descartada ao clicar fora | Perda acidental | Confirmações |
| FE-P2-08 | P2 | UX | `AppLayout`, `ProfilePage` | Papel cru, UUID em mensagens, 404 silencioso | Aparência técnica | Rótulos e páginas de erro |
| FE-P2-09 | P2 | DASHBOARD | `ReportsPage.tsx` | Relatórios sem filtros | Pouco útil | Filtros |
| FE-P2-10 | P2 | PRODUCT | `SettingsPage.tsx` | Sem dados da organização; sem excluir pipeline/tag | Configuração incompleta | Evoluir configurações |
| FE-P2-11 | P2 | UX | formulários | Sem obrigatório/validação/`inputmode` | Erros de digitação | Validação de formulário |
| FE-P2-12 | P2 | SECURITY | build | Credenciais demo no bundle | Exposição desnecessária | Build demo separado |
| FE-P2-13 | P2 | PRODUCT | `package.json` | Sem testes | Regressões não detectadas | Vitest + Playwright |
| FE-P2-14 | P2 | AUTH | `ApiClient.ts` | Logout sem aviso; `Retry-After` ignorado | Confusão do usuário | Mensagens de sessão |
| FE-P3-01 | P3 | PERFORMANCE | `useAsyncResource.ts` | Sem cache/dedupe | Requests repetidos | Lib de data fetching |
| FE-P3-02 | P3 | PERFORMANCE | `PipelinesApiRepository.ts` | N+1 de estágios | Latência | Endpoint agregado |
| FE-P3-03 | P3 | PRODUCT | `index.html`, layouts | Marca GSM hardcoded | Sem white-label | Config por tenant |
| FE-P3-04 | P3 | SECURITY | `index.html` | Google Fonts externas | Privacidade/perf | Self-host |
| FE-P3-05 | P3 | RBAC | páginas | Strings de papel espalhadas | Manutenção | `can()` centralizado |
| FE-P3-06 | P3 | PRODUCT | formulários | Fuso/telefone só BR | Limita mercado | Fuso da org |
| FE-P3-07 | P3 | UX | `ToastProvider.tsx` | Toast único | Feedback pobre | Toasts tipados |
| FE-P3-08 | P3 | PRODUCT | `repositories/mock` | Mocks no bundle de produção | Peso e ruído | Build separado |

---

## Tabela de capacidades

| CAPABILITY | EXISTS | PARTIAL | MISSING | EVIDENCE |
|---|---|---|---|---|
| Login / seleção de tenant / troca de tenant | ✔ | | | `LoginPage`, `AuthProvider.selectTenant` |
| Esqueci/redefinir senha | ✔ | | | `ForgotPasswordPage`, `ResetPasswordPage` |
| Troca obrigatória de senha | ✔ | | | `ProtectedRoute` |
| Sessão estável com refresh | | ✔ | | corrida e não persistência (FE-P1-01) |
| Guard de rota por papel | | | ✔ | `routes/index.tsx` |
| Menu por papel/escopo | ✔ | | | `NAV_ITEMS` |
| Separação Platform × Tenant | | ✔ | | só menu/blocos |
| SDR restrito | | ✔ | | backend ✔, frontend visual |
| Super Admin: organizações | | | ✔ | sem `/platform` |
| Super Admin: impersonation / auditoria | | | ✔ | — |
| Admin do tenant: usuários | | ✔ | | só criar |
| Convites | | | ✔ | — |
| Configurações da organização | | | ✔ | — |
| Pipelines (CRUD) | | ✔ | | sem excluir; mapeamento fixo |
| Estágios reais no quadro | | | ✔ | FE-P0-01 |
| Leads: criar/editar | | ✔ | | sem responsável/origem |
| Leads: paginação/filtros | | | ✔ | página 1 × 100 |
| Leads: responsável | | | ✔ | — |
| Leads: excluir/arquivar | | | ✔ | sem botão |
| Leads: comentários | ✔ | | | `LeadDrawer` |
| Leads: timeline/histórico | | | ✔ | `timeline: []` |
| Kanban drag-and-drop (desktop) | ✔ | | | `PipelinePage` |
| Mover lead no mobile/teclado | | | ✔ | FE-P1-10 |
| Import/Export CSV | ✔ | | | `LeadImportModal`, export |
| Tags | | ✔ | | criar/atribuir |
| Templates de WhatsApp + botão | ✔ | | | `WhatsappButton` |
| Tarefas | | ✔ | | sem editar/filtros |
| Lembretes/notificações | | | ✔ | — |
| Agenda | | ✔ | | sem editar |
| Dashboard | | ✔ | | KPI fictício |
| Relatórios | | ✔ | | sem filtros |
| Integrações/API | | | ✔ | grep vazio |
| Webhooks | | | ✔ | — |
| Onboarding | | | ✔ | — |
| Error boundary / páginas de erro | | | ✔ | — |
| Toasts de erro distintos | | | ✔ | "✓" fixo |
| Responsividade | | ✔ | | 11/39 CSS com media query |
| Acessibilidade básica | | ✔ | | aria-label em ícones; sem dialog/foco |
| Tema claro/escuro | ✔ | | | `ThemeProvider` |
| Headers de segurança no host | | | ✔ | `vercel.json` |
| Code-splitting | | | ✔ | chunk único |
| Testes automatizados | | | ✔ | `package.json` |
| Lint/typecheck/build | ✔ | | | comandos verdes |
| White-label | | | ✔ | branding hardcoded (informativo) |
| Modo produção garantido no deploy | | | NOT_VERIFIABLE | depende de `VITE_CRM_MODE` na Vercel |
