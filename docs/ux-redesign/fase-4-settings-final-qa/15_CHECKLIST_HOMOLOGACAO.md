# 15 — Checklist de homologação

Legenda: ✅ verificado por teste automatizado nesta fase · 🔶 verificado só parcialmente · ⬜ **depende de pessoa/ambiente real** (não executado) · ❌ falha conhecida.

## A. Pré-requisitos de ambiente (⬜ — fazer em homologação)

| # | Item | Status |
|---|---|---|
| A1 | Confirmar versões em produção/homologação: frontend `422198e`+ e backend `4cca3fb`+ (consultar o ambiente, não só o CI) | ⬜ |
| A2 | `GET /health/ready` OK e migrations no `head` (`alembic current`) | ⬜ |
| A3 | Tenant de homologação com dados **fictícios** (nunca clientes reais) | ⬜ |
| A4 | Variável `COMMIT_BEFORE_RESPONSE_ENABLED` conhecida (padrão ligada) e plano de reversão | ⬜ |

## B. Fluxos comerciais

| # | Verificação | Status |
|---|---|---|
| B1 | Pipeline: carregar, buscar, filtrar (chips), ordenar globalmente, paginar ("Carregar mais") | ✅ E2E + UI |
| B2 | Mover por arrastar, por teclado/seletor e pelo painel; rollback se a API falhar | ✅ |
| B3 | **Lead perdido pede confirmação em todos os caminhos**; cancelar preserva; ganho e movimento normal não pedem | ✅ (UI + E2E reais) |
| B4 | Criar lead e **comentar logo em seguida** sem 404 (concorrente, 2 conexões) | ✅ backend real + E2E |
| B5 | Painel: editar, validar, descartar, comentar, tarefas (próxima ação), timeline "Ver mais", ações de contato | ✅ |
| B6 | Importação CSV: 500, 501, 2.000, 10.000, 10.001 (bloqueado), inválido, duplicados, falha parcial, retomada, expiração (20 h), relatório | ✅ |
| B7 | Importação: **reinício real** do backend durante o envio | ⬜ (`restart.spec.ts` manual) |
| B8 | Configurações: pipelines, etapas (aviso de impacto), tags, origens fixas, templates, atalhos por permissão | ✅ |

## C. Segurança e acesso

| # | Verificação | Status |
|---|---|---|
| C1 | Isolamento entre tenants (leitura, escrita, importação, idempotência, **configurações**) | ✅ |
| C2 | RBAC: vendedor sem acesso a Configurações (UI e API); gestor ok; admin ok | ✅ |
| C3 | Área interna da GSM só para staff (botão ausente, URL forçada volta ao padrão, chamadas internas não feitas) | ✅ |
| C4 | Sessão de suporte (impersonação) | 🔶 testes de backend existentes; sem E2E novo |
| C5 | Teste de intrusão / varredura de dependências | ⬜ |

## D. Qualidade técnica

| # | Verificação | Status |
|---|---|---|
| D1 | ESLint, `tsc`, build do frontend; `ruff`, `mypy` do backend | ✅ |
| D2 | Vitest (468), Node (290), pytest completo (2.753 + 8 ignorados), E2E 3 navegadores | ✅ (ver `06`/`01` para a rodada final) |
| D3 | Middleware de commit: falha de commit → 500 limpo, 204/4xx/5xx/streaming/grande/concorrente | ✅ |
| D4 | Desempenho do middleware em **produção** (p95, 5xx) | ⬜ pós-deploy |
| D5 | Frontend sem requisições duplicadas e sem tarefas longas (build de produção) | ✅ |

## E. Acessibilidade e responsividade

| # | Verificação | Status |
|---|---|---|
| E1 | axe (WCAG 2.2 AA) em Pipeline, painel, CSV (5 etapas), Configurações e diálogo de "perdido": 4 resoluções × 2 temas | ✅ |
| E2 | **Leitor de tela real** (NVDA/VoiceOver) nos 4 fluxos prioritários | ⬜ **NÃO EXECUTADA** |
| E3 | Sem rolagem horizontal em 1920/1366/768/390, claro e escuro | ✅ |
| E4 | Teclado virtual real / dispositivos físicos / zoom 200 % | ⬜ |
| E5 | Contraste nas telas **não** redesenhadas (Agenda, Tarefas, Relatórios, Equipe, Dashboard, SDR, Plataforma) | ⬜ |

## F. Decisão de release

| Critério | Estado |
|---|---|
| P0 abertos | **0** |
| P1 abertos | **3** (leitor de tela, verificação em produção/observação do middleware, homologação humana) |
| Recomendação | **NÃO liberar a clientes** até fechar P1-1 e P1-3; P1-2 é verificação pós-deploy |
| Autorização de deploy | **não confundir** conclusão de implementação com autorização de release |
