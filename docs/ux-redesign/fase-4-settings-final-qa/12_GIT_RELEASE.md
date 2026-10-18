# 12 — Git e release (estado real reconstruído)

Levantado com `git`, `gh run list` e `gh run view` em 2026-10-18; nada foi publicado, mesclado, revertido ou reescrito nesta fase.

## Estado inicial (Gate Zero do Prompt 08)

| | Frontend `gsm-crm-frontend` | Backend `gsm-crm-backend` |
|---|---|---|
| `origin/main` | **`422198e`** `feat(crm): redesign do painel do lead e assistente de importacao CSV em etapas` | **`4cca3fb`** `fix(core): so entrega a resposta depois do commit (404 em criar e comentar)` |
| `HEAD` ao entrar | `422198e` (branch `feat/gsm-crm-redesign-lead-import`) | `4cca3fb` (branch `fix/gsm-crm-read-after-write-404`) |
| Árvore de trabalho | limpa | limpa |
| `main` **local** | **defasado** (aponta para `add6eb5`, 1 commit atrás de `origin/main`) | **defasado** (`8fbad84`, 1 atrás) |
| Branches de trabalho × `main` remota | as duas branches da fase 3 estão **exatamente** em `origin/main` (0 commits à frente) | idem |
| Frontend e backend sincronizados? | sim: o redesign do Prompt 07 (UI) e o middleware que ele exige (API) foram publicados juntos, no mesmo minuto (06:54 de 18/10) | |

### Cadeia de commits em `origin/main`

Frontend: `f804b2c` docs auditoria/fases 0–1A → `f032d65` importação resiliente → `b28e119` suíte E2E + janela segura → `add6eb5` redesign do Pipeline → **`422198e`** painel do lead + assistente CSV.
Backend: `1f965ea` rede de segurança de testes → `0977b50` importação idempotente → `e8cda1c` serialização + limites de campo → `8fbad84` teste de fuso → **`4cca3fb`** middleware.

### Divergência em relação ao plano original (registrada, não corrigida)

Os prompts 06 e 07 diziam "não fazer push/merge/deploy". As publicações em `main` ocorreram **por pedido explícito e posterior do usuário** ("sobe direto pra main", "pode fazer, eu te autorizo", "sobe os dois pra main quando finalizar"). Ou seja: **não** houve publicação indevida; houve mudança de instrução. Consequências a ter em mente: o redesign do Pipeline (Prompt 06) e o do painel/CSV (Prompt 07) **já estão publicados** e passaram por CI; o QA humano de homologação previsto não aconteceu **antes** do deploy.

## CI/CD e ambientes

| Evidência | Resultado |
|---|---|
| CI do frontend (`quality`: lint + tipos + testes + build) em `422198e`, `add6eb5`, `b28e119`, `f804b2c` | ✅ sucesso |
| CI do backend em `4cca3fb` e `8fbad84` (`lint`, `test` com cobertura mínima 88 %, `build`, `deploy`) | ✅ sucesso, **incluindo o job `deploy`** |
| CI do backend em **`e8cda1c`** | ❌ `test` falhou (o teste de filtro de período dependente do fuso — corrigido em `8fbad84`); `build`/`deploy` foram **pulados** nesse commit |
| Migrations | nenhuma criada nos Prompts 06–08; o CI roda `alembic upgrade head` + ida/volta (`downgrade -2`/`upgrade head`) |
| **Versão em produção** | **não verificável por mim.** O job `deploy` do backend terminou com sucesso para `4cca3fb` (Magalu Cloud), o que **indica** que a imagem desse commit foi implantada; não consultei o ambiente nem o `/health`. O frontend publica pela Vercel, sem integração visível ao `gh`; **não confirmei** qual build está no ar |

> Pendência de verificação em ambiente real (P1 de homologação): conferir em produção a versão do backend (`4cca3fb`) e do frontend (`422198e`) e a latência/5xx após o deploy do middleware.

## Branches da fase 4 (esta)

| Repositório | Branch | Base | Alterações |
|---|---|---|---|
| Frontend | `feat/gsm-crm-redesign-settings-final-qa` | `422198e` | **não commitadas** (por regra do prompt) |
| Backend | `feat/gsm-crm-redesign-settings-final-qa` | `4cca3fb` | **não commitadas** |

Arquivos alterados: ver o fim de `01_RESUMO_EXECUTIVO.md`.

## Regras cumpridas

Sem commit, push, merge, deploy, rollback, force push ou reescrita de histórico; sem migrations em produção; sem dados reais.

## Higiene sugerida (não executada)

Atualizar `main` local nos dois repositórios (`git fetch && git merge --ff-only origin/main` fora das branches de fase), apagar branches de fase já publicadas e padronizar a política de publicação (PR + aprovação) para as próximas entregas.
