# 02 — Ordenação global do Pipeline (PIP-02)

## Problema (Auditoria 01, PIP-02)

A ordenação do quadro era feita **no navegador, só sobre os 25 cards já carregados** de cada coluna (`sortBoardItems`). Numa coluna com 60 leads, "Nome A-Z" mostrava a ordem A-Z *dos 25 mais recentes*, não dos 60 — o primeiro lead em A-Z podia nem estar na tela. Era uma ordem falsa que parecia verdadeira.

## Defeito adicional encontrado no backend

`LeadModel` era ordenado por um único campo, **sem desempate e sem tratamento de nulos**. Com valores repetidos (nomes iguais, datas iguais, `last_interaction_at` nulo) a paginação por `OFFSET` podia **repetir ou pular leads entre páginas**. Corrigido em `leads/adapters/outbound/repository.py`:

```python
direction = sort_field.desc() if page.sort_dir == "desc" else sort_field.asc()
order_by_clause = direction.nulls_last()
... .order_by(order_by_clause, LeadModel.id.asc())   # desempate determinístico
```

Compatível com a API: o contrato (`sort_by`, `sort_dir`, whitelist `name, created_at, updated_at, expected_value, probability, last_interaction_at`, queda para `created_at` em campo desconhecido) não mudou.

## Solução no frontend

| Opção da tela | Enviado ao servidor |
|---|---|
| Ordenar: padrão | nada (padrão do servidor: mais recentes primeiro) |
| Nome A-Z / Z-A | `sortBy=name`, `sortDir=asc/desc` |
| Mais recentes / mais antigos | `sortBy=created_at`, `sortDir=desc/asc` |

- `PipelinePage` guarda a opção e a traduz com `serverSortFor()` (`utils/boardSort.ts`) para dentro do `filter` do quadro.
- `usePipelineBoard` já derivava `filterKey = JSON.stringify(filter)` e uma *geração*: trocar a ordenação **recarrega todas as colunas da página 1** e **descarta respostas da ordenação anterior**.
- "Carregar mais" continua a mesma ordem global (a página seguinte da mesma consulta).
- `sortBoardItems` ficou **somente para a Prospecção** (sem mudança de comportamento ali).
- Mover um lead não dispara nova consulta nem muda a ordenação escolhida; a posição do card movido na coluna de destino é a do movimento otimista até a próxima recarga (limitação conhecida, ver `09`).

## Fora do escopo (não alterado)

`last_interaction_at` (semântica intacta; D-01 depende de decisão), novas opções de ordenação (valor, probabilidade) — o backend aceita, mas a tela só expõe as 5 opções existentes.

## Testes

- Backend (`test_import_batches_and_sorting_1b.py`): paginação de 37 leads com empates em 5 campos × 2 direções sem repetir/pular; nulos sempre no fim; ordenação global em 60 leads; respeito a filtros, escopo do vendedor e tenant.
- Frontend (`pipelinePage.spec.tsx`): envio de `sortBy/sortDir` para todas as colunas e opções; 60 leads (A-Z global + "Carregar mais"); 120 leads (Z-A, antigos, recentes); nomes/datas repetidos; resposta antiga descartada; convivência com busca/responsável; falha de API; mover com ordenação ativa.
- O teste de caracterização "ordenação é APLICADA NO CLIENTE" foi **substituído de propósito** por estes.
