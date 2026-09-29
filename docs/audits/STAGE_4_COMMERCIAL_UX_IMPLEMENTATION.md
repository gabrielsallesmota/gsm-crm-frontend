# Etapa 4 — UX comercial: pronto para cliente não técnico

**Data:** 2026-09-29
**Escopo:** `gsm-crm-frontend`. O backend não foi alterado: nenhum contrato novo.
**Base:** `docs/audits/SAAS_FRONTEND_READINESS_AUDIT.md` e os relatórios das Etapas 0–3 (`gsm-crm-backend/docs/audits/`).
**Status:** implementado e verificado localmente. **Nada foi commitado nem publicado.**

---

## 1. Resumo

A proposta foi preservar a identidade visual (tokens, tema claro/escuro, componentes existentes) e atacar o que faz um cliente leigo travar: tela vazia sem orientação, jargão técnico, falta de caminho no primeiro acesso, celular e acessibilidade.

| # | Item | Situação |
|---|---|---|
| 1 | Primeiro acesso: checklist contextual, pulável, não bloqueante | ✅ |
| 2 | Empty states com próximos passos | ✅ Leads, Pipeline, Tarefas, Agenda, Equipe, Relatórios, Integrações |
| 3 | Dashboard vazio explica e orienta (sem parede de zeros) | ✅ |
| 4 | Navegação: CRM do cliente × área interna GSM | ✅ |
| 5 | Mobile: operação essencial sem arrastar | ✅ (revisão de código/CSS; ver §11) |
| 6 | Feedback padronizado (loading/skeleton, erro, vazio, proibido, offline) | ✅ |
| 7 | Formulários: rótulos, obrigatórios, e-mail, telefone, datas/fuso, duplo envio, dados preservados | ✅ nas telas do cliente |
| 8 | Acessibilidade: foco, modal com trap, labels, aria, botões de ícone | ✅ nos pontos relevantes |
| 9 | Branding centralizado, pronto para personalização futura | ✅ (sem white-label) |
| 10 | Textos técnicos → mensagens de usuário | ✅ |
| 11 | Ajuda contextual (?) em Pipeline, API/Webhooks, Equipe, Integrações, Tarefas, KPIs | ✅ |
| 12 | Performance: lazy por rota, deduplicação de requisições | ✅ bundle inicial −10% |
| 13 | Quality gate | ✅ sem warnings |
| 14 | Jornadas A–E | ✅ validadas conceitualmente + testes automatizados (§10) |

**Quality gate (local, após as mudanças):**

| Verificação | Comando | Resultado |
|---|---|---|
| Typecheck (app) | `npx tsc -b` | ✅ sem erros |
| Typecheck (testes) | `npx tsc -p tsconfig.test.json --noEmit` | ✅ sem erros |
| Lint | `npx eslint . --max-warnings 0` | ✅ 0 erros, 0 avisos |
| Testes | `npm test` | ✅ **119/119** (24 novos em `tests/stage4.test.ts`; 1 expectativa atualizada) |
| Build | `npx vite build` (saída fora do projeto) | ✅ sem avisos de chunk |
| Backend (jornadas) | 7 suítes de integração: `stage1_crm`, `dashboard_metrics`, `rbac`, `stage2_platform`, `impersonation`, `stage3_integrations`, `user_management` | ✅ **103 passed**. Backend inalterado; rodado como evidência das jornadas |

---

## 2. Primeiro acesso (onboarding)

**Onde:** cartão "Boas-vindas ao GSM CRM, {nome}" no topo do Dashboard, implementado em `components/onboarding/OnboardingChecklist.tsx`.

**Passos por papel** (`utils/onboarding.ts`):

| Passo | Admin | Gestor | Vendedor | Marcado como feito quando |
|---|:-:|:-:|:-:|---|
| Veja onde ficam seus leads | ✓ | ✓ | ✓ | existe ≥ 1 lead **ou** a pessoa abriu Leads |
| Entenda o pipeline | ✓ | ✓ | ✓ | a pessoa abriu o Pipeline |
| Adicione sua equipe | ✓ | — | — | há mais alguém ativo na equipe |
| Crie sua primeira tarefa | ✓ | ✓ | ✓ | existe ≥ 1 tarefa |
| Conecte seu site ou WhatsApp | ✓ (se API/Webhooks contratados) | — | — | há credencial ativa ou webhook |

- **Baseado no dado real**, não em "cliquei no passo". Cada passo tem um botão que leva à tela certa. O de leads abre direto o cadastro (`/leads?novo=1`).
- **Não bloqueia nada:** o cartão pode ser minimizado ("Minimizar") ou dispensado ("Pular tutorial"). Quando tudo está feito, vira "Tudo pronto!" com "Fechar".
- **Reexibir:** Meu perfil → "Mostrar primeiros passos".
- **Custo:**
  - uma consulta por sinal, com `page_size=1` (só o total), e apenas dos passos que aquele papel vê;
  - com o tutorial dispensado, nada é consultado;
  - uma falha num sinal (403 ou rede) só deixa aquele passo em aberto.
- **Estado local** (`localStorage`, chave por usuário + organização): se pulou e quais telas visitou. Nada vai ao servidor.

---

## 3. Empty states

`EmptyState` virou o componente único para ausência de conteúdo:
- **tons:** `empty`, `error`, `forbidden`, `offline` e `done`, cada um com ícone próprio;
- **ações:** 0 a N ações (botão ou link de rota), a primeira destacada;
- **variante `compact`** para dentro de listas.

O uso antigo (`action` isolada) continua funcionando.

| Tela | Antes | Agora |
|---|---|---|
| Leads (sem nenhum) | "Nenhum lead cadastrado ainda." | Explica o que é lead + **Adicionar lead · Importar planilha · Configurar integração** (esta só para quem gerencia integrações) |
| Leads (filtro sem resultado) | "Nenhum lead com esses filtros." | Mensagem + **Limpar filtros** |
| Pipeline (sem leads) | N colunas "Sem leads" | Faixa "Seu funil ainda está vazio" + **Adicionar lead · Importar planilha** |
| Pipeline (sem pipeline/etapas) | Texto fixo "crie em Configurações" | Admin/gestor: explica o que é pipeline + **Abrir Configurações**. Vendedor: "fale com seu administrador" |
| Tarefas | Uma frase para todas as abas | Texto por aba. Em "Atrasadas" e "Hoje", vazio é boa notícia (tom `done`). Em "Todas", explica o que é tarefa + **Nova tarefa · Ver leads** |
| Agenda | "Nenhum compromisso neste período." | Explica + **Novo compromisso · Ver próximos 30 dias** |
| Equipe (só você) | — | "Por enquanto, só você" + **Convidar pessoa** |
| Relatórios | — | Estado vazio explicativo |
| Integrações | Texto solto | Explica para que serve cada credencial/webhook + **Nova credencial / Novo webhook** |
| Rota sem permissão, não contratada ou inexistente | Texto + link solto | Tom `forbidden` + **Voltar ao início** |

---

## 4. Dashboard vazio

Sem nenhum lead e sem filtro de período, o grid de 11 KPIs, os gráficos e o funil **não são exibidos**. No lugar:

- **Admin/gestor:** "Seu dashboard aparece aqui", com a explicação de que os números vêm dos leads, e as ações **Adicionar lead · Importar planilha · Conectar site ou WhatsApp**.
- **Vendedor:** "Você ainda não tem leads", explicando que a carteira aparece quando um lead é atribuído ou cadastrado.
- **Com período filtrado e sem dados:** "Nenhum lead neste período" + **Ver todo o período**. Isso evita confundir "vazio" com "zerado".

Também mudaram:
- **Carregamento:** skeleton de cards, no lugar de "Carregando…".
- **Definição de cada KPI:** antes era um `title` (só com mouse). Agora é um botão **?** que funciona no toque e no teclado.

---

## 5. Navegação (arquitetura de informação)

A lista de itens saiu do `AppLayout` para `layouts/navigation.ts`, que é puro e testado. São duas seções que nunca se misturam:

- **CRM do cliente**, na ordem pedida: Dashboard · Pipeline · Leads · Tarefas · Agenda · Relatórios · **Equipe** · **Integrações** · Configurações.
  - "Usuários" virou **Equipe**, em `/equipe`; `/usuarios` redireciona para lá.
  - Integrações só aparece para Admin **e** com API ou Webhooks contratados.
- **Área interna GSM:** Clientes GSM · SDR · Plataforma GSM.
  - É um grupo separado, com título próprio, visível só para platform staff.
  - Some durante sessão de suporte, como já acontecia com as permissões.
  - O cliente nunca vê nem o título.

A GSM Platform continua com layout próprio (`/platform`), e o SDR continua em chunks lazy, fora do bundle do cliente.

**Topbar:**
- **Busca global funcional:** antes era um campo morto. Agora, Enter leva a `/leads?busca=…` com a busca preenchida.
- **"+ Lead"** abre o cadastro direto (`/leads?novo=1`), inclusive se você já estiver em Leads.
- **Seletor de organização** ganhou rótulo acessível.
- **"Meu perfil" passou a ser alcançável:** a rota existia sem nenhum link. Agora o bloco nome/papel na sidebar é um link para ela.

---

## 6. Mobile (operação essencial sem arrastar)

| Ação | Como funciona no celular |
|---|---|
| Visualizar leads | A lista mostra só **Lead + Etapa** (as demais colunas somem abaixo de 640px, sem rolagem horizontal). Os filtros ficam em grade 2×N |
| Abrir lead | Toque na linha → ficha em tela cheia |
| Mudar etapa | Seletor de etapa no card do Pipeline (visível em telas de toque) **e** na ficha do lead. Nada exige arrastar |
| Comentar | Campo de comentário na ficha |
| Criar tarefa | "Nova tarefa" na ficha ou em Tarefas. O modal abre **ancorado embaixo** (bottom sheet) |
| Concluir tarefa | Quadrado de concluir com área de toque ≥ 36px (≥ 40px em ponteiro grosso). A linha quebra em duas |
| Pesquisar | Busca da topbar (tecla "buscar" do teclado virtual) e busca da lista |
| Dashboard | KPIs em 2 colunas; a definição de cada um no "?" |
| Agenda | Linhas quebram; abas de período roláveis |

**Regras globais em ponteiro grosso (`pointer: coarse`):**
- botões e selects com altura mínima de 40px;
- campos com fonte de 16px, o que evita o zoom automático do iOS ao focar.

---

## 7. Feedback padronizado

| Estado | Padrão |
|---|---|
| **Loading** | `SkeletonRows` e `SkeletonCards` na primeira carga de Leads, Pipeline, Tarefas, Agenda, Equipe, Dashboard, Relatórios e Integrações. Recargas mantêm o conteúdo antigo (`aria-busy`), sem spinner global. A rota lazy usa skeleton, e a restauração de sessão mostra uma tela da marca em vez de página em branco |
| **Success** | Toast verde (já existia, Etapa 1) |
| **Warning** | Toast âmbar (já existia) |
| **Error** | `EmptyState tone="error"` com **Tentar de novo** em todas as telas do cliente. As mensagens passam por `describeError` |
| **Empty** | §3 |
| **Forbidden** | `tone="forbidden"`: sem permissão, módulo não contratado ou página inexistente |
| **Offline** | Faixa fixa "Você está sem conexão…" (`useOnlineStatus`, eventos `online`/`offline`). Erros de rede da API continuam como toast ("Não foi possível conectar ao servidor…") |

---

## 8. Formulários

| Item | O que mudou |
|---|---|
| Labels | Login, esqueci a senha e troca de senha agora usam `htmlFor`/`id` (antes o label não era associado). Os modais já usavam `<label>` envolvendo o campo |
| Obrigatórios | Marcados com `*` e o aviso "Campos com * são obrigatórios" em Novo lead, Tarefa, Compromisso e Convidar pessoa, com `required`/`aria-required` implícito |
| Validação | `utils/validation.ts`: e-mail (formato) e telefone BR (DDD + 8/9 dígitos). O erro aparece **depois de sair do campo ou tentar salvar**, com `aria-invalid` + `aria-describedby`. Campos opcionais vazios nunca bloqueiam |
| Mensagens | Em português e acionáveis ("Telefone incompleto. Inclua o DDD (ex.: (11) 91234-5678)") |
| Telefone | `type="tel"`, `inputMode="tel"`, máscara BR (já existia), placeholder de exemplo |
| E-mail | `type="email"`, `inputMode="email"`, `autoComplete` |
| Datas / fuso | Tarefa e compromisso mostram "Horário de {fuso}" (já existia). Data inválida → mensagem com instrução. O backend continua recusando horário sem fuso |
| Duplo envio | Botões desabilitados durante o envio (já existia em todos os formulários revisados) |
| **Preservação de dados** | **Novo:** depois que a pessoa digita qualquer coisa num modal, clique fora e Esc **não fecham mais**, só Cancelar/×. A ficha do lead também não fecha por Esc ou clique fora com edição ou comentário em andamento. Erro de API mantém o modal aberto com os dados (já era assim) |

---

## 9. Acessibilidade

- **Modal** (`components/common/Modal.tsx`) e **ficha do lead**, via o hook `useDialog`:
  - `role="dialog"`, `aria-modal` e `aria-labelledby` (título) / `aria-describedby`;
  - **focus trap** (Tab e Shift+Tab presos no diálogo);
  - foco inicial no primeiro campo (ou no `autoFocus`); ao fechar, o **foco volta** ao botão que abriu;
  - Esc fecha, respeitando a proteção de dados;
  - diálogos empilhados (confirmação sobre formulário): só o do topo reage;
  - trava o scroll do fundo e o restaura corretamente, em qualquer ordem de fechamento.
- **Foco visível:** `:focus-visible` global com contorno na cor de destaque (antes os botões não tinham indicação consistente).
- **"Pular para o conteúdo":** skip link no topo, apontando para o `<main id="conteudo">`.
- **Teclado no Pipeline:** o card é `role="button"` com `tabIndex=0`; Enter ou Espaço abre o lead, onde dá para trocar a etapa sem arrastar.
- **Botões só de ícone:**
  - tarefas e agenda: os `aria-label` agora incluem o item ("Concluir tarefa: Ligar para Ana"), e concluir usa `aria-pressed`;
  - "Sair" e "Fechar" ganharam rótulos claros;
  - os glifos são `aria-hidden`.
- **Filtros alternáveis:** Ativo/Passivo, para staff, com `aria-pressed`.
- **Anúncios:**
  - erros de login e troca de senha com `role="alert"`;
  - skeletons com `role="status"` e texto para leitor de tela;
  - progresso do onboarding com `role="progressbar"`.
- **`prefers-reduced-motion`** respeitado (animações praticamente desligadas).
- **Contraste** (fórmula WCAG sobre os hex do tema):
  - **corrigido:** no tema claro, `--muted-2` sobre o fundo da página dava 4,23:1, abaixo do AA 4,5:1. Passou de `#6b7682` para `#636e7a`: 4,75:1 no fundo e 5,2:1 nos cards;
  - demais pares conferidos: `--muted` 6,2:1, `--muted-2` escuro 5,2 a 5,6:1, faixa offline 7,5:1, texto sobre o verde de destaque 5,9:1.

---

## 10. Jornadas validadas

**Método:** não há ferramenta de navegador neste ambiente (nem Playwright no projeto). Cada jornada foi validada em três camadas:
1. leitura do fluxo de telas e rotas no código após as mudanças;
2. testes de lógica do frontend (navegação, permissões, onboarding, validação, erros);
3. testes de integração do backend que exercitam os mesmos passos contra Postgres/Redis reais (103 passando).

### Cenário A — Primeiro admin

| Passo | Caminho na interface | Evidência automatizada |
|---|---|---|
| Login | `/login`: labels associados e erro anunciado. Com senha temporária → `/trocar-senha` (já existia) | `test_auth_flow`, `test_change_password_flow` |
| Onboarding | Dashboard → "Boas-vindas…" com 5 passos (admin com API contratada) | `stage4.test.ts` › onboarding (passos por papel, conclusão pelo dado real, pular salvo por usuário + organização) |
| Cria vendedor | Passo "Adicione sua equipe" → Equipe → **Convidar pessoa** (papel Vendedor, e-mail validado) | `test_stage1_crm::test_invite_flow_without_password_then_first_access`, `test_user_management` |
| Cria lead | "+ Lead" (topbar) ou passo 1 → modal Novo lead | `test_leads_crud` (rodado na suíte completa do backend) |
| Move no pipeline | Pipeline → arrastar, seletor no card ou ficha do lead | `test_stage1_crm::test_seven_stage_funnel_moves_lead_through_every_stage_and_persists` |
| Cria tarefa | Ficha do lead → "Nova tarefa" (ou Tarefas) | `test_stage1_crm::test_task_lifecycle_with_assignee_edit_reschedule_and_completion` |
| Conclui | Quadrado "Concluir tarefa: …" | idem |
| Consulta dashboard | KPIs aparecem assim que existe lead; passos marcados como feitos | `test_dashboard_metrics` |

### Cenário B — Integração

| Passo | Caminho | Evidência |
|---|---|---|
| Admin cria API Key | Integrações → API → **Nova credencial** (o `?` explica API × Webhook) | `test_stage3_integrations::test_credential_lifecycle_never_exposes_secret_or_hash` |
| Copia o secret | `SecretReveal`: copiar + "Guardei este valor" obrigatório; o valor nunca é exibido de novo | idem (o secret só existe na resposta de criação) |
| Integração cria lead | `POST /api/v1/public/leads` | `test_stage3_integrations::test_intake_fields_and_no_mass_assignment` |
| Lead aparece | Leads (filtro "Sem responsável") e Pipeline, na primeira etapa em andamento | `test_stage1_crm::test_unassigned_filter_lists_public_intake_queue` |
| Origem correta | Coluna Origem mostra o canal (Instagram, WhatsApp…). `api` agora aparece como **"Integração"**. Timeline: "Lead criado via formulário/integração", ator "Integração (API)" | `test_stage1_crm::test_public_intake_records_api_actor`; mapa de origens cobre os 8 valores do backend |

### Cenário C — Vendedor

| Passo | Caminho | Evidência |
|---|---|---|
| Vê somente o permitido | Menu sem Equipe/Integrações/Configurações/GSM; Dashboard "seus leads" | `stage4.test.ts` › navegação ("vendedor não vê administração"); `permissions.test.ts` |
| Trabalha seus leads | Leads/Pipeline/Tarefas escopados no backend | `test_stage1_crm::test_assign_reassign_and_filter_by_owner_respects_seller_scope`, `test_rbac` |
| Não acessa administração | URL direta → "Acesso restrito" + Voltar ao início; o backend responde 403 | `permissions.test.ts` (`evaluateRouteAccess`), `test_rbac` |

### Cenário D — GSM

| Passo | Caminho | Evidência |
|---|---|---|
| Super Admin | Grupo "Área interna GSM" → Plataforma GSM | `stage4.test.ts` › "staff GSM vê o grupo interno separado" |
| Organização | `/platform/organizations/:id` (Etapa 2) | `test_stage2_platform` |
| Suporte | Iniciar sessão de suporte → banner com contagem; o grupo interno some do menu | `stage4.test.ts` › "em sessão de suporte o staff não vê o grupo interno"; `test_impersonation` |
| Encerra impersonation | Banner → Encerrar | `test_impersonation`, `platform.test.ts` |
| SDR interno | Área interna GSM → SDR (chunk lazy, fora do bundle do cliente) | `test_stage2_platform` (dados internos no tenant da plataforma) |

### Cenário E — Mobile (vendedor)

| Passo | Caminho | Validação |
|---|---|---|
| Abre lead | Leads (2 colunas) → toque → ficha em tela cheia | CSS revisado (`LeadsPage.module.css` ≤ 640px; drawer `width: min(460px, 100%)`) |
| Muda etapa | Seletor "Etapa" na ficha ou no card do Pipeline (visível só em toque) | `PipelinePage.module.css` (`.cardMove` oculto só em `hover:hover` + `pointer:fine` ≥ 761px) |
| Comenta | Campo de comentário na ficha; Esc/toque fora não descartam o texto | `useDialog` com `hasUnsaved` |
| Cria tarefa | "Nova tarefa" na ficha → bottom sheet; data com calendário nativo | `Modal.module.css` ≤ 560px |

---

## 11. Branding

**`src/config/brand.ts`** é o **único** lugar com nome do produto, empresa, site e logo em texto (`<GSM />` + "CRM"). Quem usa:
- logo da sidebar e do login;
- rodapé do login, com ano automático (antes "© 2026" fixo);
- título da aba (`usePageTitle` → "Leads · GSM CRM", por tela).

**Hardcodes auditados:**

| Local | Situação |
|---|---|
| `AppLayout` e `AuthLayout` (logo, rodapé) | Migrados para `brand.ts` |
| `<title>` do `index.html` | Continua "GSM CRM" como valor inicial, substituído por tela via `usePageTitle` |
| Favicon / apple-touch-icon | Arquivos em `public/`, mantidos |
| Cores e fontes | Já centralizadas em `theme.css` (tokens) |
| Textos "Fale com a GSM" | Mantidos de propósito: a GSM é a fornecedora |
| E-mails `@gsmautomacao` | Só no modo demonstração (não visível ao cliente em produção) |

**Personalização futura:** `resolveBrand(tenant)` já é o ponto de extensão. Hoje devolve sempre a marca padrão (há teste garantindo). Para white-label, basta o backend expor os campos por organização e essa função mesclá-los. **White-label não foi construído.**

**Textos da tela de login:** "Multi-tenant" e "Pronto para IA" (jargão ou promessa) viraram "Funil visual · Funciona no celular · Integra com site e WhatsApp".

---

## 12. Textos técnicos → mensagens de usuário

| Antes | Depois |
|---|---|
| Mensagens do Pydantic em inglês ("Field required", "String should have at least 1 character", "Extra inputs are not permitted", "value is not a valid email address"…) | Português: "campo obrigatório", "precisa ter pelo menos 1 caractere(s)", "campo não permitido", "e-mail inválido". Mensagem desconhecida em inglês vira "valor inválido", nunca o inglês cru. Mensagens do nosso backend (já em português) são mantidas |
| Nome de campo cru (`company`, `url`, `scopes`…) | 14 rótulos novos em português (`FIELD_LABELS`) |
| "Não foi possível trocar de **tenant**" / "selecionar o **tenant**" | "…de organização" / "…entrar nesta organização" |
| Origem "API" / "Landing" | "Integração" / "Site / landing page" |
| Papel cru no Perfil ("admin") | "Administrador" (`roleLabel`) |

Uma busca por `backend`, `UUID`, `endpoint`, `IntegrityError`, `ValidationError` e `tenant` em textos visíveis das telas do cliente não encontra mais ocorrências. Os pontos restantes são áreas internas da GSM ou a lista técnica de endpoints de cada permissão na criação de credencial de API, que é de propósito.

---

## 13. Ajuda contextual

Componente `HelpTip`: um botão "?" que abre um balão curto.
- Funciona com toque, teclado (Enter, Esc) e mouse.
- No celular, o balão vira um cartão fixo na parte de baixo da tela.

| Onde | Conteúdo |
|---|---|
| Pipeline | O que é cada coluna, 3 formas de mover, 🏆/✕ alimentam conversão e receita |
| Integrações | API (outro sistema envia para o CRM) × Webhook (o CRM avisa outro sistema) |
| Equipe | O que cada papel pode fazer; desativar não apaga histórico |
| Tarefas | Vínculo com o lead; "Hoje/Atrasadas" em horário de Brasília |
| KPIs do Dashboard | Definição de cada indicador (substitui o `title`, que só funcionava com mouse) |
| API Keys / Webhooks | Textos introdutórios da Etapa 3, mais os estados vazios explicativos |

Deliberadamente curto: 2 a 4 frases, sem manual.

---

## 14. Performance

**Lazy por rota:** Tarefas, Agenda, Relatórios, Configurações, Equipe e Perfil viraram chunks próprios. Dashboard, Pipeline e Leads ficam no bundle inicial, porque são a primeira tela e as mais usadas. Platform e SDR já eram lazy (Etapas 1–2).

| Bundle inicial (`index-*.js`) | Antes | Depois |
|---|---|---|
| Tamanho | 497,3 kB | **445,5 kB** |
| gzip | 147,8 kB | **137,9 kB** (−10%) |

A comparação foi feita com o build do `HEAD` anterior, num worktree temporário já removido.

**Requisições duplicadas:**
- Ao abrir a ficha de um lead a partir de Leads ou Pipeline, pipelines, tags e o diretório da equipe eram pedidos de novo pela página, pela ficha e pelo modal de tarefa.
- Agora `utils/requestCache.ts` (`sharedRequest`) reaproveita a mesma promessa por 15 s e por organização.
- `reload()` invalida a chave, então recarregar continua buscando dado novo; erro não fica em cache.
- Sem otimização além disso (sem biblioteca de cache): a auditoria marcou TanStack Query como P3.

---

## 15. Páginas e arquivos alterados

**Páginas:**
- `DashboardPage`: onboarding, estado vazio, skeleton, KPI com "?", `aria-pressed`
- `LeadsPage`: `?novo`, `?busca`, estado vazio contextual, skeleton, validação do formulário, colunas no mobile
- `PipelinePage`: `?importar`, estados vazio e erro, ajuda, card acessível por teclado, "Importar planilha"
- `TasksPage`, `AgendaPage`: estados vazios por contexto, skeleton, erro com retry, alvos de toque
- `UsersPage` → **Equipe**: título, ajuda de papéis, "só você", validação do convite
- `IntegrationsPage` (e as abas API/Webhooks): ajuda, estados vazio, erro e não contratado
- `ReportsPage`, `SettingsPage`: título, skeleton, erro com retry
- `ProfilePage` → **Meu perfil**: papel legível, "Mostrar primeiros passos"
- `LoginPage`, `ForgotPasswordPage`: labels associados, `role="alert"`

**Layout e rotas:**
- `layouts/AppLayout.tsx` + `.module.css`: seções de navegação, skip link, busca, "+ Lead", offline, link para o perfil, marca
- `layouts/AuthLayout.tsx` + `.module.css`: marca e textos
- `routes/index.tsx`: lazy por rota, `/equipe`, redirect `/usuarios`, Suspense nos módulos contratados
- `routes/RequirePermission.tsx`: estados forbidden e não encontrado padronizados, loading com skeleton
- `routes/ProtectedRoute.tsx`: tela da marca durante a restauração da sessão
- `constants/routes.ts`: `equipe`

**Componentes:**
- `common/EmptyState` (reescrito)
- `common/Modal` (reescrito: dialog acessível e proteção de dados)
- `common/Skeleton` (novo)
- `common/HelpTip` (novo)
- `onboarding/OnboardingChecklist` (novo)
- `leads/LeadDrawer`: `useDialog` e proteção de edição e comentário
- `kpi/KpiCard`: definição via HelpTip
- `tasks/TaskFormModal`, `calendar/EventFormModal`: obrigatórios e mensagens
- `auth/ChangePasswordForm`: labels e autocomplete
- `integrations/ApiCredentialsTab`, `WebhooksTab`: estados

**Hooks e utilitários:**
- **Novos:** `hooks/useDialog`, `useOnboarding`, `useOnlineStatus`, `usePageTitle`; `utils/onboarding`, `validation`, `requestCache`; `config/brand`; `layouts/navigation`
- **Alterados:** `hooks/usePipelines`, `useTags`, `useTeamDirectory` (deduplicação); `utils/apiErrors` (tradução do 422); `constants/origins` (rótulos)
- **Estilos:** `styles/global.css` (`:focus-visible`, `.sr-only`, skip link, toque, reduced motion, splash) e `styles/theme.css` (`--muted-2` claro com contraste AA)

**Testes:**
- `tests/stage4.test.ts` (novo, 24 testes): navegação por papel e suporte, onboarding, validação, tradução de erros, deduplicação, marca
- `tests/apiErrors.test.ts`: uma expectativa atualizada (a mensagem do Pydantic agora é traduzida)

---

## 16. Limitações

| Limitação | Detalhe |
|---|---|
| Sem E2E em navegador | As jornadas foram validadas por código + testes de lógica + integração do backend (§10). Não houve clique real num navegador nem num celular físico |
| Onboarding por dispositivo | O estado de "pulei/visitei" vive no `localStorage`. Em outro navegador o cartão reaparece (os passos feitos continuam feitos, porque vêm do dado real) |
| Onboarding só no Dashboard | Se o módulo Dashboard não estiver contratado, o checklist não aparece |
| "Entenda o pipeline" | Conta como feito ao abrir a tela; não mede entendimento |
| Áreas internas não revisadas | Plataforma GSM, SDR e a ficha de Clientes GSM (`ClientDrawer`) ficaram fora desta etapa: modal/drawer antigos, textos internos, "Carregando…" |
| Arrastar por teclado | O card abre por teclado e a etapa muda na ficha; arrastar colunas/cards continua só com mouse (por design) |
| Offline | Só detecta a rede do navegador; não há fila de envio offline |
| Contraste | Pares principais calculados pela fórmula WCAG (e um corrigido); não houve varredura com ferramenta (axe/Lighthouse) em todas as combinações |
| Fontes externas | Google Fonts continua (auditoria P3: auto-hospedar) |
| Modo demonstração | O código de mock segue no bundle de produção (auditoria P3) |

---

## 17. Itens que podem ficar para a V2

1. **Playwright** com as 5 jornadas acima (desktop + viewport de celular) no CI.
2. Tour guiado dentro das telas (destaques passo a passo). Hoje há checklist + ajuda "?", o que basta para o primeiro cliente.
3. Onboarding sincronizado no servidor (preferências por usuário) e e-mail de boas-vindas com os mesmos passos.
4. Personalização por organização (logo, nome, cor) via `resolveBrand`.
5. Revisão das áreas internas GSM (Plataforma, SDR, Clientes) com os mesmos componentes.
6. Camada de cache de dados (TanStack Query) para substituir `useAsyncResource` + `sharedRequest`.
7. Auditoria WCAG com ferramenta (axe) e testes de leitor de tela (NVDA/VoiceOver).
8. Filtros em Relatórios (período, pipeline, responsável).
9. Central de ajuda / base de conhecimento linkada a partir dos "?".
10. Fontes auto-hospedadas e build de demonstração separado.

**Não feito, por instrução:** deploy, commit e push.
