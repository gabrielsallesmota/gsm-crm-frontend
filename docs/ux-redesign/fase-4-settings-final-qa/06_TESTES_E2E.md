# 06 — Testes E2E (Playwright) e investigação de intermitência

Ambiente **isolado** e descartável: banco `gsm_crm_e2e` recriado a cada execução, API na 8110, front na 5174, **400 tenants** independentes, senha aleatória por execução, dados fictícios, nenhum e-mail/mensagem real. Chromium roda a suíte inteira; Firefox e WebKit rodam o conjunto `@cross`.

## Mudanças na infraestrutura de teste (esta fase)

| Mudança | Por quê |
|---|---|
| Front servido pelo **build de produção** (`vite build` + `vite preview`); `E2E_DEV=1` volta ao servidor de desenvolvimento | o dev server compila cada rota na 1ª visita; uma tela chegou a ficar em "Carregando a tela…" por mais de 15 s. Também deixa o teste **fiel à produção** (sem o `StrictMode` duplicando efeitos). Suíte completa: **~26–33 min → ~17 min** |
| Faixa extra de tenants só do Chromium (151–200 → 351–400); servidor sobe com 400 tenants | números novos sem deslocar as faixas existentes |
| `Api.comment` **sem** retentativa de 404 (Prompt 07) | a retentativa escondia o bug do commit |
| `loginUi` registra falhas de rede e 5xx em `e2e/.artifacts/network-failures.log` (**fora** de `results/`) | `results/` é apagado a cada execução; a evidência da intermitência de login se perdeu duas vezes assim |
| Axe espera `document.getAnimations()` terminarem | o axe mede contraste com a **opacidade do momento**; no diálogo em animação de entrada o resultado oscilava |

## Cobertura nova

`settings.spec.ts` (13): categorias e `?secao=`, atalhos por permissão, menu com **um** item ativo, pipelines/etapas (criar, editar, Ganho/Perdido exclusivos, excluir com aviso de impacto), tags, origens fixas (D-04), templates (criar, duplicado, excluir), celular, **RBAC + IDOR** (vendedor 401/403, gestor ok, outro tenant 403/404), e **D-03** (seletor, arrastar real, painel, erro com rollback, movimento normal). `a11y-settings.spec.ts` (16 axe). `perf-measure.spec.ts` (manual).

## Resultado da rodada completa final

**Rodada E (final, mesmo código que será entregue): 227 passaram · 0 falharam · 2 ignorados (manuais) · 229 testes · 17,0 min.**

| Navegador | Passaram | Escopo |
|---|---|---|
| Chromium | **173** | suíte completa |
| Firefox | **27** | conjunto `@cross` |
| WebKit | **27** | conjunto `@cross` |
| **Total** | **227** | |

Ignorados (por desenho, não por falha): `restart.spec.ts` (reinício REAL do backend, manual) e `perf-measure.spec.ts` (medição, `RUN_PERF=1`).

## Investigação da intermitência de login (pedido 15)

**Sintomas observados** (todos em execuções completas; nenhum em reexecução isolada):

| # | Quando | Sintoma |
|---|---|---|
| 1 | P07, rodada final | `timeline longa`: `getByLabel('E-mail')` não apareceu em 180 s |
| 2 | P08 rodada A | `atalhos…` (Configurações): tela presa em **"Carregando a tela…"** (rota lazy no dev server) por > 15 s |
| 3 | P08 rodada C | `import 422`: login volta com **"Não foi possível conectar ao servidor"** (fetch rejeitado), 15 s |
| 4 | P07 rodada 1 | após `page.reload()` o app voltou ao login (provável refresh de sessão com falha de rede) |

**Hipóteses testadas e resultado**

| Hipótese | Teste | Resultado |
|---|---|---|
| Lentidão do login/backend | 60 logins sequenciais (dev server): `goto /login` p50 659 ms · digitar 62 ms · enviar→app p50 338 ms (máx 4,5 s) | 60/60 ok |
| Intermitência causada pelo **middleware de commit** | A/B: **300 logins em contextos novos** com o middleware ligado | **300/300 ok** (p50 505 ms · p95 587 ms) — o A/B "desligado" **não** foi necessário porque o lado "ligado" não reproduziu (interruptor `COMMIT_BEFORE_RESPONSE_ENABLED` criado para isso e para reverter em produção) |
| Dev server do Vite compilando rotas | passar a servir o build de produção | eliminou o sintoma #2; **não** o #3 (ocorreu já com o build) |
| Estado compartilhado entre testes | cada teste usa tenant próprio, contexto novo, senha por execução; `repeat-each` na **mesma** base falha por colisão de dados (dado esperado, não é instabilidade) | sem evidência de vazamento de estado |
| Falha de rede no nível do **sistema operacional** | `network-failures.log` da rodada D (167 linhas): quase todas são **falhas injetadas de propósito** pelos testes de importação (`ERR_CONNECTION_RESET` por `route.abort`, 500 simulados) e navegações canceladas no Firefox/WebKit; **uma** é inesperada: `GET /tasks … net::ERR_NO_BUFFER_SPACE` (esgotamento de buffers de socket do Windows) | **evidência direta de que a máquina de teste (Windows, centenas de conexões loopback/ TIME_WAIT) pode recusar conexões espontaneamente** |

**Conclusão (classificação P2, causa provável, não provada):** a intermitência restante é **ambiental** — falha de conexão no Windows sob a carga da bateria longa — e **não** foi atribuída ao código da aplicação nem ao middleware (300/300 logins ok; os 5xx observados são os injetados). Não foi resolvida aumentando *timeouts* e nenhum teste foi marcado como ignorado.

**Recomendações (não executadas):** rodar a bateria no CI em Linux/container; ampliar a faixa de portas efêmeras / reduzir `TcpTimedWaitDelay` na máquina local; manter o `network-failures.log` ligado para cada incidente. **Risco:** o CI do frontend roda lint, tipos, Vitest e build — **não roda Playwright**; as garantias E2E dependem de execução manual (P2).

## Taxa de falha observada nesta fase (rodadas completas, mesmo código)

| Rodada | Total | Passou | Falhou | Natureza das falhas |
|---|---|---|---|---|
| A (dev server) | 229 | 225 | 2 | rota lazy presa (dev server) + teste de template (corrida real: formulário desmontava — **defeito de produto corrigido**) |
| B (build de produção) | 229 | 225 | 2 | `redesign › filtros` em 2 navegadores: teste verificava as requisições **antes do debounce** — corrida do **teste**, corrigida com `expect.poll` |
| C | 229 | 225 | 2 | axe durante animação (**teste**, corrigido) + **login com falha de rede** (ambiental) |
| D | 229 | 226 | 1 | teste de template (ordem das esperas, corrigido) |
| **E (final)** | 229 | **227** | **0** | 2 ignorados por desenho (manuais) |

Ou seja: **toda falha foi diagnosticada**; 3 eram corridas dos **testes**, 1 era **defeito real do produto** (agora corrigido, com teste de regressão) e 1 é **intermitência ambiental** de rede do Windows (1 ocorrência de login em 5 rodadas completas e **0 falhas em 360 logins isolados** (60 + 300); taxa não estimável com precisão).

## Mantido fora da rodada automática

`restart.spec.ts` (reinício REAL do backend durante a importação) — manual (`E2E_ALLOW_RESTART=1`); **não reexecutado nesta fase**. `perf-measure.spec.ts` — manual (`RUN_PERF=1`).
