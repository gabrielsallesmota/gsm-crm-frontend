# 03 — Histórico, atividades e a investigação do HTTP 404

## Timeline

- Fonte: `GET /leads/{id}/timeline` (eventos comerciais reais + comentários), mais recentes primeiro. **Nenhum tipo novo.**
- Cada item ganhou uma **família visual** (`timelineKind`): comentário (azul), tarefa (âmbar), funil — criação, etapa, ganho/perdido, responsável (verde), integração (roxo), dados/outros (neutro). O tipo também aparece em **texto** ("Comentário", "Tarefa", "Funil", "Integração"), então a cor não é o único sinal.
- Lista semântica (`ol/li`), ícone decorativo (`aria-hidden`).

### "Ver mais" sem paginação fictícia

O backend já aceita `?limit=` (1–500; padrão 100). O painel:

1. mostra os **10** mais recentes dos que já foram carregados;
2. "Ver mais (N)" revela +20 do que **já está no navegador**;
3. quando tudo que veio foi exibido e o servidor devolveu exatamente o que foi pedido, aparece **"Carregar eventos mais antigos"**, que repete a chamada com `limit=500` (contrato existente);
4. com 500 eventos informa o teto: "Exibindo os 500 eventos mais recentes — o limite desta tela".

A primeira chamada continua **sem** `limit` (teste de contrato `a timeline é pedida SEM limite`). Ordem cronológica preservada; recarregar (após comentar/mover/tarefa) mantém a janela escolhida.

### Comentários

Criação, permissões, erros e recarga da timeline inalterados. O texto digitado é mantido se o envio falha, e conta como alteração não salva (fechar o painel pede confirmação).

## Investigação do possível 404 ("criar lead e comentar logo em seguida")

**Sintoma (Prompt 06, P6):** 3 em ~30 semeaduras de E2E devolveram 404 no comentário, sob carga; 0/60 em isolamento.

### O que foi verificado

| Item pedido | Resultado |
|---|---|
| Identificador retornado | o `id` do POST /leads é o mesmo usado no comentário (correto) |
| Cache / navegação / abertura do drawer | não participam: o 404 ocorre entre dois pedidos de API encadeados, sem UI |
| Endpoint de comentários | `CreateLeadCommentUseCase` busca o lead por `get(lead_id)`; sem lead visível → `NotFoundError` (404) |
| Transações e visibilidade | **causa encontrada** (abaixo) |
| Consistência entre conexões | o 404 só ocorre se o 2º pedido chega por **outra conexão** |
| E2E × real | o E2E (Node/undici e navegador) abre várias conexões; em produção atrás do Traefik também |

### Causa raiz (medida, não suposta)

O commit da transação fica na **saída** da dependency `get_tenant_db`. No FastAPI 0.141 — e com os `BaseHTTPMiddleware` do app (métricas, log, headers de segurança), que repassam o corpo em pedaços — essa saída roda **depois de a resposta já ter sido entregue**. Um segundo pedido por outra conexão pode chegar antes do `COMMIT` e não enxergar o lead.

Evidência (`tests/integration/test_read_after_write_visibility.py`, uvicorn real em TCP, duas conexões persistentes):

- Com o commit atrasado artificialmente em 4 s, o `POST /leads` respondeu em **24 ms** e o `GET /leads/{id}` seguinte devolveu **404 por todo o atraso** (40 tentativas seguidas), depois 200. A janela existe.
- Sem atraso, a janela é de milissegundos: 150 ciclos sequenciais e 120 em concorrência não a acertaram — por isso "0/60 em isolamento" e o aparecimento só sob carga.
- Na mesma conexão keep-alive o uvicorn só atende o pedido seguinte quando o anterior termina, o que **esconde** o problema; foi preciso usar duas conexões.

### Correção (pequena, segura, compatível)

`app/core/commit_before_response.py` — middleware ASGI puro, o mais externo antes do proxy: guarda em memória os pedaços do corpo e só os envia quando a aplicação terminou (commit incluso). Corpo > 1 MB (exportação em streaming) é liberado e segue direto. Se a aplicação falha depois (ex.: commit estoura), o corpo guardado **não** é enviado: o cliente vê erro em vez de um falso 201.

- Não altera o ciclo de transações, endpoints, esquemas ou migrations; não há `BackgroundTasks` no app que pudessem ser atrasados.
- Custo: a resposta passa a sair depois do commit (comportamento anterior ao FastAPI 0.118).
- Testes: 3 de integração (natural, concorrência 6×20, atraso de 1,5 s → POST demora ≥ 1,5 s e o GET/comentário seguinte veem o lead), 4 unitários do middleware, e o E2E `criar lead e comentar logo em seguida` (6 clientes × 8 ciclos, **sem** retentativa — a retentativa de 404 do helper `Api.comment` foi removida).
- Suíte completa do backend verde com o middleware.

### Alternativa descartada

`Depends(get_tenant_db, scope="function")` resolveria na origem, mas exigiria mudar ~84 pontos de uso de `get_tenant_db` e revisar todos os provedores de repositório que dependem dele (o escopo precisa ser consistente na cadeia; não foi testado nesta fase). É alteração arquitetural grande: fica documentada como opção futura, não implementada.
