# GSM CRM Frontend

App React (Vite + TypeScript) do CRM da GSM Automação, separado do site institucional
(`gsm-site`). Roda em dois modos, com a **mesma interface** nos dois:

- **Demo** (`VITE_CRM_MODE=demo`) — dados 100% mockados em memória, nunca acessa API/banco.
  Pensado para demonstrações a clientes, gravação de vídeo e testes de UX sem depender do backend.
- **Produção** (`VITE_CRM_MODE=production`) — fala com o `gsm-crm-backend` (FastAPI) real.

Se `VITE_CRM_MODE` não estiver definido, o modo é inferido pelo hostname (`demo.*` → demo,
`crm.*` → produção; qualquer outro, inclusive dev local, cai em demo por padrão).

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # ajuste VITE_CRM_MODE e VITE_CRM_API_URL se necessário
npm run dev
```

Login de demonstração (modo Demo): a tela de login tem dois botões de entrada rápida —
**Entrar (Empresa)** (usuária comum de uma empresa) e **Admin GSM** (acesso multi-tenant).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento (Vite) |
| `npm run build` | `tsc -b` + build de produção |
| `npm run lint` | ESLint (`@typescript-eslint` + `react-hooks` + `react-refresh`) |
| `npm run preview` | Serve o build de produção localmente |

## Arquitetura: Service → Repository → {Api \| Mock}

Nenhuma página importa API ou dados mockados diretamente. A cadeia é sempre:

```
Página (pages/) → hook (hooks/useX.ts) → Service (services/XService.ts)
                                              ↓
                                  Repository (interface em repositories/X.ts)
                                              ↓
                        repositories/api/XApiRepository.ts   (produção)
                        repositories/mock/XMockRepository.ts (demo)
```

`services/factory.ts` decide, uma única vez por domínio, qual implementação usar com base no
modo (`CRM_MODE`). É essa centralização — e a regra de que páginas só enxergam hooks — que
garante zero diferença de interface entre Demo e Produção: não existe `if (modo === 'demo')`
espalhado pelas telas.

### Estrutura de pastas

```
src/
  types/          tipos de domínio (Lead, Pipeline, User, DashboardMetrics, ...)
  constants/      config compartilhada entre Demo e Produção (estágios, origens, rotas)
  mock/           fixtures estáticas + funções de derivação puras (dashboard, relatórios)
  repositories/   interfaces por domínio, + api/ e mock/ (implementações)
  services/       uma classe fina por domínio + factory.ts (escolhe api vs mock)
  contexts/       AuthContext (sessão, tenant) e ToastContext
  hooks/          useLeads, useDashboard, useTasks, ... (única porta de entrada das páginas)
  routes/         tabela de rotas (react-router-dom) + ProtectedRoute
  layouts/        AppLayout (sidebar/topbar) e AuthLayout (tela de login)
  components/     componentes de UI reutilizáveis (kpi/, leads/, pipeline/, charts/, common/)
  pages/          uma página por rota
  styles/         theme.css (tokens de cor/fonte) e global.css
```

## Lacuna atual do backend

O `gsm-crm-backend` hoje implementa os módulos `auth`, `leads`, `pipelines` e `dashboard`
(métricas agregadas). As telas de **Tarefas, Agenda e Relatórios** ainda não têm endpoint — o
`ApiRepository` desses domínios lança um erro tipado (`NotImplementedError`) e a página mostra
um empty-state explicando isso, em vez de tela branca ou dado inventado. Essas telas funcionam
de verdade hoje apenas no modo Demo; passam a funcionar em produção automaticamente, sem tocar
em código de UI, assim que o backend ganhar os endpoints correspondentes.

O Dashboard já consome `GET /api/v1/dashboard` de verdade em modo produção
(`DashboardApiRepository`), com uma única ressalva: o KPI "1º atendimento"
(`avgFirstContactHours`) fica fixo em `0`, porque o backend ainda não registra o momento do
primeiro contato de um lead — mesma lacuna do campo `firstContactHours` em `LeadsApiRepository`.

Da mesma forma, o cadastro de Lead no backend real é mais enxuto que o mock (sem timeline de
atividades, IA, sentimento, objeções ou campos customizados) — essas seções aparecem vazias em
produção até o backend passar a registrar esse histórico.

## Como adicionar um novo Mock

1. Adicione a fixture em `src/mock/<dominio>.ts` (dado puro, sem saber nada de Repository).
2. Implemente a interface do domínio em `src/repositories/mock/<Dominio>MockRepository.ts`,
   lendo de `src/mock/<dominio>.ts` e de `repositories/mock/state.ts` (store em memória).
3. Repita a implementação real em `src/repositories/api/<Dominio>ApiRepository.ts` (ou use
   `NotImplementedError` se o endpoint ainda não existir no backend).
4. Registre as duas em `services/<Dominio>Service.ts`, escolhendo por `CRM_MODE`.

## Deploy

Recomendado: dois deployments Vercel do mesmo repositório —
`crm.gsmautomacao.com.br` com `VITE_CRM_MODE=production` + `VITE_CRM_API_URL` apontando para a
API real, e `demo.gsmautomacao.com.br` com `VITE_CRM_MODE=demo`. `vercel.json` já traz o
rewrite-all necessário para o roteamento client-side (react-router).
