# 10 — Performance

> **Sem linha de base anterior:** não existe medição prévia confiável do frontend (nem builds antigos instrumentados). Os números abaixo são **absolutos, desta máquina** (Windows, Chromium, API e banco locais, dados fictícios) e servem para **achar gargalos e requisições duplicadas**, não para declarar melhoria ou regressão. Nenhuma otimização foi feita "no escuro".

Medição: `e2e/perf-measure.spec.ts` (manual, `RUN_PERF=1`) — 120 leads em 2 etapas, 1440×900. Executada **duas vezes**: contra o servidor de desenvolvimento do Vite e contra o **build de produção** (`vite preview`), porque o `StrictMode` do React duplica efeitos em desenvolvimento.

## Resultado (build de produção)

| Fluxo | Medido |
|---|---|
| Carga do Pipeline (login feito → quadro pronto) | 3,1 s *(inclui as esperas do helper `openPipeline`, não é "tempo até o primeiro cartão")*; 9 chamadas à API; **0 duplicadas** (as 4 de `leads?…page=1` são **4 etapas distintas**) ; 0 tarefas longas (> 50 ms) |
| **Abrir o painel do lead** (clique → timeline visível), 10 aberturas | **mediana 159 ms** (137–187 ms); 3 chamadas (`tags`, `timeline`, `tasks`), **0 duplicadas**; 0 tarefas longas |
| Configurações: carga | 0,9 s; 4 chamadas (`me`, `tenants`, `pipelines`, `tags`), **0 duplicadas** |
| Configurações: trocar de categoria | **39 ms** (sem chamadas novas — a categoria de comunicação carrega só quando aberta) |
| **Importação CSV de 10.000 linhas** (só navegador, sem enviar) | ler + analisar: **111 ms**; avançar para a revisão (validação das 10.000 linhas e lotes): **109 ms**; 0 tarefas longas |

## Comparação desenvolvimento × produção (mesmos testes)

| Item | Dev (`StrictMode`) | Produção |
|---|---|---|
| Chamadas duplicadas ao abrir o painel | `timeline` ×2, `tasks` ×2 | **nenhuma** |
| Duplicadas na carga do Pipeline | `auth/me` ×2, `auth/tenants` ×2, `lead-message-templates` ×2 | **nenhuma** |
| Abrir o painel (mediana) | 195 ms | 159 ms |
| Tarefa longa ao abrir o painel | 1 (54 ms) | 0 |

**Conclusão honesta:** as "requisições duplicadas" observadas em desenvolvimento são **artefato do `StrictMode`** (efeitos montados duas vezes de propósito) e **não existem em produção**. Não foi preciso corrigir nada. Isso também mostra que **medir só no servidor de desenvolvimento enganaria**.

## Bundle

| | Prompt 06 | Prompt 07 | Agora (Prompt 08) |
|---|---|---|---|
| JS principal (`index-*.js`) | 393,5 kB | 413,4 kB | **414,3 kB** (gzip 127,5 kB) |

+0,9 kB nesta fase (navegação das Configurações e confirmação de perda); sem dependência nova. As Configurações já eram carregadas sob demanda (`lazyPage`).

## Pipeline: re-renderização e vazamentos

- Cartões em `React.memo` com callbacks estáveis (Prompt 06) preservados; o diálogo de "perdido" é montado só quando há confirmação pendente, então o arraste não ganhou trabalho extra.
- Listeners: o `useDialog` remove o `keydown` no desmonte (testado indiretamente pelos E2E de foco/Esc); **não** rodei um profiler de heap nem testes de vazamento de memória (não medido).

## Backend (resumo — detalhe em `05`)

Middleware de commit: **+0,6 a +3,3 ms no p50** (≈ 3–11 %); p95/p99 ruidosos, sem conclusão. Uso de conexões/CPU/memória **não medidos**.

## Não medido

Rede lenta/CPU limitada (throttling), dispositivos móveis reais, Lighthouse/Core Web Vitals, carga com milhares de cartões na mesma coluna, desempenho do Firefox/WebKit, tempo de importação real de 10.000 linhas ponta a ponta (coberto funcionalmente em `06`, não cronometrado como métrica de desempenho).
