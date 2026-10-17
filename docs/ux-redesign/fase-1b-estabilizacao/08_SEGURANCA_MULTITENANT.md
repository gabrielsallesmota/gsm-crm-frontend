# 08 — Segurança e isolamento multi-tenant

A UI nunca é a fronteira: cada cenário confere o que o **servidor** responde e grava (Postgres real, RLS ativa).

## Backend (`test_import_security_stabilization.py`, 10 testes + 1B)

| Cenário | Resultado |
|---|---|
| Sessão de suporte **somente leitura** importa | **403** ("somente leitura"); **nada** gravado; a chave **nem chega a ser reservada** (0 linhas em `idempotency_keys`) |
| Sessão de suporte **elevada** importa | permitido e rastreável; a chave do **suporte** (usuário staff) é de outro escopo que a do cliente: o admin do tenant com a mesma chave **executa de verdade** (não recebe a resposta do suporte) |
| Staff da GSM (sem vínculo com o tenant) importa para um tenant de cliente | recusado (403/404/422); nada gravado |
| Pipeline, etapa ou responsável de **outro tenant** | 404/422 em cada um dos 3 campos; **nada** gravado em nenhum tenant; a chave é **liberada** |
| Vendedor tenta atribuir os leads ao admin | todos ficam do **vendedor** (`default_owner_id` ignorado) |
| Vendedor + telefone de lead alheio + "atualizar" | `skipped/permission`; o lead alheio **não** é alterado; o **nome alheio nunca aparece** na resposta |
| Mesma `Idempotency-Key` em **outro tenant** ou **outro usuário** | nunca devolve a resposta alheia (executa de verdade); vendedor/admin não leem o replay um do outro |
| 3 tenants importando ao mesmo tempo | todos concluem; locks por tenant não se bloqueiam |
| Lock de um tenant | **não** bloqueia outro tenant nem leitura do mesmo tenant (teste com o lock segurado por outra transação) |
| Sem autenticação | 401/403 |

## E2E (`security.spec.ts`, navegador + API reais)

- Tenants A e B com **nomes e telefones iguais**: cada um vê só os próprios leads (UI e API).
- Lead de outro tenant: `GET/PATCH/move/DELETE` → **404** e o lead alheio permanece intacto.
- Importar com pipeline/etapa/responsável do outro tenant → recusado; **0 leads em ambos**.
- Mesma `Idempotency-Key`: admin A (1ª = criou 3; reenvio = replay), gestor A (executou de verdade: 3 ignorados), admin B (criou 3 — não herdou nada do A).
- Papéis na tela: admin e gestor veem **6** leads, vendedor vê **2**; vendedor sem controles de reordenar etapas.
- Sem sessão: `/pipeline` redireciona ao login; a API recusa.

## Locks e vazamento

A chave do lock é `leads.bulk_import:<tenant_id>`: tenants diferentes **não compartilham** lock. Uma colisão de hash de 64 bits só causaria uma espera, nunca acesso a dados. A leitura de qualquer dado continua sob RLS (`app.tenant_id`) — o lock não toca em linhas.

## Auditoria e PII

`leads.imported` por lote guarda só contagens, estratégia e ids de pipeline/etapa/chave. O texto do relatório baixado fica no navegador. Fórmulas (`= + - @ TAB CR`) são neutralizadas no CSV do relatório (E2E lê o arquivo baixado) e no export do servidor (E2E importa `=1+1` e `@SUM(A1)` e confere `'=1+1`).

## Não coberto

Staff GSM com **UI** de suporte (não existe sessão de suporte semeada no ambiente E2E); coberto só no backend. Teste de autorização por **leitor de tela** não aplicável.
