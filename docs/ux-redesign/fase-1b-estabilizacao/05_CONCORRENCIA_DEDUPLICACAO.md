# 05 — Concorrência e deduplicação (risco R1)

## O problema, com evidência

A idempotência da 1B protege o **reenvio do mesmo lote**. Não protegia **duas importações independentes** com o mesmo telefone: ambas consultam "esse telefone existe?", ambas ouvem "não" e ambas criam. Não existe (e não pode existir) índice único em telefone — a estratégia "criar duplicado" é legítima.

Reprodução **antes** da correção (Postgres real, requisições simultâneas, `asyncio.gather` com transações independentes; lock desligado):

| Cenário | Esperado | Obtido sem lock |
|---|---|---|
| 2 importações simultâneas, 150 telefones, "ignorar" (mesmo usuário) | 150 leads | **298** |
| idem, 2 usuários do mesmo tenant | 150 | **300** |
| 6 importações simultâneas, 80 telefones | 80 | **273** |
| 2 importações simultâneas, "atualizar" | 150 | **298** |

**Achado que quase escondeu o defeito:** na **primeira** importação de um tenant, o INSERT da fonte de lead (`lead_sources`, chave única por tenant) serializa as duas transações por acidente (a segunda espera o `commit` da primeira *antes* da primeira consulta de telefone). Em qualquer tenant "em regime" (fonte já existente) a corrida é real. Os testes semeiam a fonte antes de disputar (`_warm_org`), senão passariam por sorte.

## Solução escolhida: lock consultivo transacional por tenant

`pg_advisory_xact_lock(hashtextextended('leads.bulk_import:<tenant_id>', 0))`, tomado no início da transação do lote (`app/core/advisory_locks.py`, usado em `POST /leads/bulk-import`).

| Propriedade | Decisão |
|---|---|
| Escopo | **por tenant** e só para a importação. Outros tenants nunca esperam; leitura e demais rotas do mesmo tenant não esperam. |
| Duração | até o `COMMIT`/`ROLLBACK` do lote (a resposta idempotente é gravada na MESMA transação). |
| Se o processo morrer | a conexão cai e o Postgres solta o lock; nada fica preso. |
| Espera máxima | `lock_timeout` de 30 s; estourou → **409** com `Retry-After: 2` e a reserva da chave é liberada. O cliente já repete 409 com a **mesma chave**. |
| Efeito sobre a estratégia | nenhum: "ignorar", "atualizar" e "criar duplicado" mantêm a semântica. "Duplicar" continua duplicando (intencional). |
| Isolamento | READ COMMITTED: depois do lock, cada consulta enxerga o que a importação anterior já commitou. |
| Por que não... | **índice único**: proibiria "duplicar" · **lock distribuído (Redis)**: desnecessário, o Postgres já é a fonte da verdade · **lock no navegador**: não é garantia (outra aba/usuário/máquina). Sem migration. |

### Proteção adicional: reserva "presa" assumida por um reenvio

A reserva de uma chave "processing" com mais de 60 s é tratada como processo morto e pode ser assumida. Se na verdade a 1ª execução ainda roda (lote lento), as duas gravariam o lote. Agora, depois de obter o lock, o servidor **relê** a chave: se a outra execução já a concluiu, devolve a resposta guardada (`Idempotent-Replayed: true`) **sem regravar** (`idempotency.completed_replay`). Medição: um lote de 500 linhas leva ~6 s (10.000 linhas em 1,9 min no E2E), ~10× abaixo dos 60 s.

## Evidência depois da correção

`tests/integration/test_import_concurrency_stabilization.py` — **10 testes, todos verdes** (e os 4 de corrida falhavam sem o lock):

- 2 abas do mesmo usuário e 2 usuários do mesmo tenant ("ignorar") → **150 leads, `created` somado = 150, `skipped` somado = 150**;
- 6 importações simultâneas → 80 leads;
- 2 importações "atualizar" → 1 lead por telefone, valor final consistente;
- "criar duplicado" simultâneo → 2 leads por telefone (**duplicação intencional preservada**);
- tenants diferentes simultâneos → ambos concluem, mesma chave não colide;
- mesmo lote + mesma chave simultâneo → grava uma vez (409 para o 2º, replay depois);
- reserva envelhecida assumida por reenvio → replay, **0 regravações**;
- lock de outro tenant e leitura do mesmo tenant **não** esperam;
- espera estourada → 409 + chave liberada + reenvio funciona.

E2E (navegador real, `import.spec.ts`): 2 abas, 2 usuários, "duplicar" simultâneo e 2 tenants — todos verdes.

## Limites conhecidos

- Cobre **importação × importação**. Criar lead manualmente ao mesmo tempo que uma importação não é serializado (o formulário manual não deduplica por telefone).
- O lock é por tenant: duas importações grandes do mesmo tenant são **enfileiradas** lote a lote (intercalam por lote, nunca em paralelo). É o comportamento desejado.
