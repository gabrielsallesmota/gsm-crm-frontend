# 05 — Homologação do `CommitBeforeResponseMiddleware`

Arquivo: `gsm-crm-backend/app/core/commit_before_response.py` (ASGI puro, ~45 linhas). Registrado em `app/main.py` por fora de CORS/segurança/log/métricas e por dentro apenas do proxy de IP.

## 14.1 Revisão arquitetural

| Item pedido | Conclusão (com a evidência) |
|---|---|
| **Ordem dos middlewares** | a pilha é: proxy de IP (mais externo) → **este** → CORS → headers de segurança → log → métricas → limite de corpo → roteador. Precisa ficar por fora dos `BaseHTTPMiddleware` (log/métricas/segurança), que são quem devolve a resposta antes de a aplicação terminar. Se ficasse por dentro, não seguraria nada (medido: o 404 persistia) |
| **Ciclo de transações** | o commit continua na saída de `get_tenant_db` (dentro da chamada ASGI). O middleware não toca em transação: só **adia o envio** até a chamada ASGI voltar |
| **Tratamento de exceções** | `await self.app(...)` propaga; o que estava guardado **não** é enviado. Sem cabeçalho enviado, o servidor responde um **500 limpo** |
| **Respostas HTTP / headers / status** | guardados e liberados na mesma ordem (cabeçalho antes do corpo). Testado: 201/200/204/4xx/5xx mantêm status, `content-type` e `content-length` |
| **Streaming e respostas grandes** | corpo > 1 MB (`MAX_HELD_BYTES`): o que já foi guardado é enviado e o resto **segue direto** (sem reter na memória). No app só há `StreamingResponse` em **exportações CSV** (leads e prospects), leitura. Abaixo de 1 MB a exportação inteira é entregue de uma vez, no fim |
| **Desconexão do cliente** | socket que envia o POST e fecha: **fechando imediatamente (0 ms)** o servidor **não processou** o pedido (lead inexistente); **fechando 50 ms depois** o servidor **processou e commitou** (lead existe e íntegro). Em nenhum caso há estado pela metade. Um controle (mesmo pedido lendo a resposta) devolveu `201`. **Não comparei** com a aplicação sem o middleware, então não atribuo o comportamento de 0 ms a ele |
| **Cancelamento de requisição** | **não testado separadamente** (só a desconexão após o envio da requisição, linha acima); o middleware não cria nem cancela tarefas: o comportamento de cancelamento é o do Starlette/uvicorn, sem alteração conhecida |
| **Uso de conexões** | o middleware **não** segura conexão de banco: a sessão fecha dentro da chamada ASGI, como antes; ele só retém bytes em memória. Não foi instrumentado o *pool* (limitação) |
| **Rollback / erro no commit** | ver 14.2: o cliente nunca recebe 2xx de um commit que falhou |

**Achado de revisão (corrigido nesta fase):** a primeira versão do middleware segurava só o corpo; numa falha de commit o cabeçalho (ex.: `201`) já tinha saído e o cliente via uma resposta **truncada**. Agora o **cabeçalho também é retido**, e a falha vira 500 completo.

**Efeito colateral a conhecer:** o `RequestLoggingMiddleware`/`MetricsMiddleware` medem até a resposta do inner app e **não** incluem o tempo do commit (que agora acontece antes de a resposta chegar ao cliente, mas fora da medição deles). A latência vista pelo cliente é ~1–3 ms maior que a registrada no log (ver 14.3). Observabilidade: considerar medir por fora (P3).

## 14.2 Testes

`tests/integration/test_commit_middleware_audit.py` (servidor uvicorn **real**, 2 conexões) + `test_read_after_write_visibility.py` + `tests/unit/test_commit_before_response.py` — **14 testes verdes**:

| Cenário pedido | Teste | Resultado |
|---|---|---|
| Criar lead e comentar imediatamente | `create_then_comment_immediately_over_a_real_server` (150 ciclos) | ✅ 0 × 404 |
| Criar e consultar imediatamente | idem + `response_waits_for_a_slow_commit…` (commit atrasado 1,5 s → POST demora ≥ 1,5 s; o GET seguinte vê o lead) | ✅ |
| Atualizar e consultar | `update_then_read_on_another_connection…` (20 PATCH + GET por outra conexão) | ✅ |
| Falha de commit | `commit_failure_never_answers_success…` | ✅ **500**, lead **não** persistido |
| Falha após persistência | `5xx_after_a_write_rolls_back…` (caso de uso grava e levanta) | ✅ **500** completo, comentário **não** fica |
| Resposta 204 | `204_has_no_body…` (DELETE) | ✅ sem corpo, exclusão já visível |
| 4xx | `4xx_responses_keep_status…` (422, 404, 401) | ✅ status, JSON e `content-length` corretos |
| 5xx | `5xx_after_a_write…` | ✅ |
| StreamingResponse | `export_csv_arrives_complete` (60 leads) + unitário "corpo grande segue direto" | ✅ |
| Respostas grandes | unitário `large_bodies_stream_instead_of_being_held` (> 1 MB) | ✅ |
| Requisições concorrentes | `with_concurrent_clients` (6 × 20 rodadas) | ✅ 0 × 404 |
| Cliente some após enviar | `client_disconnect_after_sending…` | ✅ sem estado pela metade |
| Escopos não-HTTP (lifespan/websocket) | unitário | ✅ passam direto |

Suíte completa do backend: ver `06`/`01` (resultado final).

## 14.3 Performance

`tests/perf/test_bench_commit_middleware.py` (manual, `RUN_BENCH=1`): **mesma aplicação** servida duas vezes — com o middleware e com ele trocado por um repasse (linha de base **medida aqui**, não herdada) —, em alternância por rodada, servidor real, banco local de teste, dados fictícios. 5 rodadas × (60 POST + 60 GET + 15 listagens de 100 + 5 exportações + 8 POST simultâneos). **3 execuções** completas.

Mediana de cada percentil entre as 3 execuções (ms; valores por execução entre colchetes):

| Operação (n por execução) | p50 sem | p50 com | Δ p50 | p95 sem | p95 com | Δ p95 |
|---|---|---|---|---|---|---|
| `POST /leads` (300) | 22,5 [22,5 · 22,7 · 22,5] | 24,4 [23,7 · 25,2 · 24,4] | **+1,9** | 27,6 | 33,8 | +6,3 |
| `GET /leads/{id}` (300) | 12,7 [12,7 · 12,6 · 12,7] | 13,3 [12,6 · 13,6 · 13,3] | **+0,6** | 16,7 | 18,2 | +1,5 |
| `GET /leads?page_size=100` (75) | 20,3 | 21,7 | **+1,4** | 26,9 | 31,0 | +4,1 |
| `GET /leads/export` CSV (25) | 30,6 | 34,0 | **+3,3** | 39,6 | 42,1 | +2,6 |
| 8 `POST` simultâneos (40) | 83,9 [83,9 · 228,2 · 77,7] | 82,6 [79,0 · 82,6 · 97,9] | −1,3 (ruído) | ≈ 2.280 | ≈ 2.220 | ruído |

Leitura honesta:

- **Custo mensurável e pequeno:** +0,6 a +3,3 ms no p50 (≈ 3–11 %). Nas escritas é o tempo do commit que antes ficava **depois** da resposta e agora está **antes** — é exatamente o comportamento desejado (o cliente só vê sucesso depois de gravado).
- **p95/p99 são ruidosos** (máquina de desenvolvimento, Windows, outliers isolados de até ~2 s em ambos os lados, ex. p99 de exportação 2.131 ms *sem* o middleware numa das execuções). **Não** declaro regressão nem melhoria nos p95/p99.
- O **p95 de ~2,2 s** nos POST simultâneos aparece **nos dois lados** (efeito da primeira rajada abrir 8 conexões novas), não é do middleware.
- **Não medido:** uso do *pool* de conexões, uso de CPU/memória, comportamento em rede real/Traefik, carga sustentada. Tamanho do corpo retido ≤ 1 MB por requisição em voo (limite configurado).
- Uma das 4 primeiras tentativas do benchmark terminou com `ReadError` de conexão (não se repetiu nas execuções seguintes); causa não identificada — registrado como observação, sem evidência de relação com o middleware (ocorreu antes da 1ª medição completa).

## 14.4 Decisão

**Preservar o middleware** (com a retenção do cabeçalho adicionada). Não há problema crítico: a janela de 404 foi eliminada, falhas de commit viram 500 limpo, streaming grande não é retido, o custo é de ~1–3 ms. **Não** foi necessário alterar o ciclo transacional do FastAPI. A alternativa estrutural (`scope="function"` em ~84 usos de `get_tenant_db`) permanece **não implementada** e documentada.

**Recomendação de release do backend:** observar latência do cliente (p95) e taxa de 5xx nas primeiras horas. **Reversão sem novo deploy de código:** variável de ambiente `COMMIT_BEFORE_RESPONSE_ENABLED=false` (interruptor criado nesta fase em `app/core/config.py`; padrão **ligado**). Desligar volta ao comportamento anterior e **reabre** a janela do 404 de "criar e ler logo em seguida".
