# 11 — Arquivos, branches e commits

## Commits da Fase 1B (exclusivos, autorizados no prompt; locais, **sem push**)

| Repositório | Branch | Hash | Mensagem |
|---|---|---|---|
| Backend | `feat/gsm-crm-ux-phase-1b` | **`0977b50`** | `feat(leads): stabilize idempotent batch import and global ordering` |
| Frontend | `feat/gsm-crm-ux-phase-1b` | **`f032d65`** | `feat(crm): add resilient CSV import and accessible pipeline controls` |

Antes do commit, a árvore tinha só arquivos da 1B (revisado em `02`). O backend foi commitado **sem** nenhuma alteração da estabilização (o `router.py` foi reduzido temporariamente à versão 1B e restaurado depois).
Hashes anteriores: 1A frontend `5b2d545` + docs `f804b2c`; Fase 0 frontend `f419886…`, backend `1f965ea`.

## Estabilização — **NÃO commitada** (a pedido), branch `test/gsm-crm-phase-1b-stabilization` nos dois repositórios

### Backend

| Arquivo | Tipo | Por quê |
|---|---|---|
| `app/core/advisory_locks.py` | novo | lock consultivo transacional por tenant (R1) |
| `app/core/idempotency.py` | M | `completed_replay` (releitura após o lock) |
| `app/modules/leads/adapters/inbound/router.py` | M | usa o lock e a releitura em `POST /leads/bulk-import` |
| `app/modules/leads/domain/services.py` | M | `validate_import_field_lengths` (linha venenosa) |
| `app/modules/leads/application/use_cases.py` | M | aplica a validação por linha |
| `scripts/e2e_backend.py` | novo | banco/API **isolados** para E2E (recusa outro banco) |
| `tests/integration/test_import_concurrency_stabilization.py` | novo | 10 testes (R1) |
| `tests/integration/test_import_security_stabilization.py` | novo | 10 testes (multi-tenant/papéis/suporte) |
| `tests/integration/test_import_idempotency_window_stabilization.py` | novo | 5 testes (TTL/R4) |
| `tests/integration/test_import_poison_rows_stabilization.py` | novo | 8 testes (limites de coluna) |
| `tests/integration/test_connections_api.py` | M | **teste instável corrigido** (corpo do evento gerado 2× com `now()`); falhava também na 1B, sem relação com a importação |

### Frontend

| Arquivo | Tipo | Por quê |
|---|---|---|
| `src/utils/leadImport.ts` | M | janela de retomada (R4), limites de coluna |
| `src/components/leads/LeadImportModal.tsx` | M | registro por assinatura, bloqueio de retomada vencida, parar ao sair da tela |
| `src/repositories/api/LeadsApiRepository.ts` | M | timeout de 120 s por lote |
| `src/pages/PipelinePage.module.css` | M | contorno de foco do seletor "mover" |
| `tests/leadImport.test.ts`, `tests/ui/leadImportModal.spec.tsx` | M | +5 Node, +17 UI |
| `playwright.config.ts`, `tsconfig.e2e.json`, `tsconfig.json`, `.gitignore`, `package.json`, `package-lock.json` | novo/M | infraestrutura Playwright (2 devDependencies: `@playwright/test`, `@axe-core/playwright`) |
| `e2e/` (`*.spec.ts` ×6, `support/` ×4) | novo | 135 testes E2E |
| `docs/ux-redesign/fase-1b-estabilizacao/` | novo | estes 13 documentos |

Migrations: **nenhuma**. Endpoints: **nenhum novo**. Contratos de API: **inalterados** (409 por lock é um status já tratado como "repetir" pelo cliente).

## Artefatos não versionados

`e2e/.artifacts/` (resultados, relatório JSON, 40 capturas, JSONs do axe) está no `.gitignore`.
