# 07 — Segurança e multi-tenant

| Tema | Como ficou | Evidência |
|---|---|---|
| Isolamento entre tenants | Chave de idempotência escopada por **tenant + usuário + operação**; RLS inalterada. Mesma chave em outro tenant/usuário não colide nem vaza resposta. | `test_keys_are_scoped_by_user_and_by_tenant`, `test_the_stored_replay_contains_no_data_from_other_tenants_and_respects_roles` |
| Permissões | Gates do endpoint inalterados (vendedor importa para si; papéis sem acesso recusados; sessão de suporte somente leitura). | `test_batch_import_keeps_the_existing_authorization_gates`; matriz de rotas (`test_route_role_matrix`) |
| Reuso indevido da chave | Mesma chave com **outro corpo → 422**; em processamento → **409**; chave inválida (vazia, espaços, > 128) → recusada sem gravar. | testes de chave/corpo/inválidas |
| Idempotência durável | Resposta gravada **na mesma transação** do lote; falha libera a chave; reserva de processo morto expira em 60 s; TTL 24 h. | `…failed_batch_releases_the_key…`, `…stuck_reservation…expires…`, concorrência |
| PII em logs/auditoria | Auditoria `leads.imported` guarda só contagens, `dedupe_strategy`, IDs de pipeline/etapa e `batch_key` — **nunca nome/telefone**. A chave não contém dado pessoal (`imp-<id aleatório>-<n>`). | `test_every_batch_is_audited_with_counts_only…` |
| Fórmulas em CSV | O relatório baixado neutraliza `= + - @ TAB CR` (mesma regra do export do servidor). | `leadImport.test.ts` (CSV do relatório) |
| Armazenamento local | `localStorage` guarda apenas `{assinatura, importId, data}` por tenant+usuário — **sem linhas da planilha**; falha de acesso é tolerada. | teste de retomada em `leadImportModal.spec.tsx` |
| Abuso/volume | Limites no cliente (10.000 linhas, 5 MB) **e** no servidor (2.000 por requisição, inalterado). Lotes sequenciais, sem paralelismo. | testes de limites |
| Credenciais | Nenhum teste usou produção; importações grandes só contra banco de teste local / mocks. | — |

## Limites de confiança

O cliente é conveniência, não fronteira: validação, permissão e dedupe são decididos no servidor; um cliente adulterado ainda é limitado por RLS, papéis, esquema Pydantic e limite de 2.000.
