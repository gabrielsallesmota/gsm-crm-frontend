# 08 — Arquivos alterados (Fase 1B)

Branch `feat/gsm-crm-ux-phase-1b` nos dois repositórios. **Nada commitado, sem push/merge/deploy.**

## Backend (`gsm-crm-backend`)

| Arquivo | Tipo | Motivo |
|---|---|---|
| `app/modules/leads/adapters/inbound/router.py` | M | `Idempotency-Key` por lote, auditoria por lote |
| `app/modules/leads/adapters/inbound/schemas.py` | M | `reason` na resposta por linha |
| `app/modules/leads/application/dtos.py` | M | `ImportRowResult.reason` |
| `app/modules/leads/application/use_cases.py` | M | preenche `reason` |
| `app/modules/leads/adapters/outbound/repository.py` | M | ordenação determinística (nulos no fim + desempate por id) |
| `tests/integration/test_import_batches_and_sorting_1b.py` | N | testes da 1B |
| `tests/integration/test_planned_future_phases.py` | M | remove os cenários D-10 (implementados) |

## Frontend (`gsm-crm-frontend`)

| Arquivo | Tipo | Motivo |
|---|---|---|
| `src/utils/leadImport.ts` | N | motor da importação |
| `src/components/leads/LeadImportModal.tsx` | M | prévia, progresso, relatório, retomada |
| `src/components/prospects/ProspectImportModal.tsx` | M | `Modal` compartilhado + rótulos + alerta |
| `src/types/lead.ts`, `repositories/LeadsRepository.ts`, `repositories/api/LeadsApiRepository.ts`, `repositories/mock/LeadsMockRepository.ts`, `hooks/useLeadActions.ts` | M | `idempotencyKey`, `reason` |
| `src/utils/boardSort.ts` | M | `serverSortFor`; comentário (client-side só na Prospecção) |
| `src/pages/PipelinePage.tsx`, `PipelinePage.module.css` | M | ordenação no servidor; botões de etapa; seletor "mover" descobrível |
| `src/components/prospects/WhatsappButton.module.css`, `leads/EmailButton.module.css` | M | alvos de toque |
| `src/pages/SettingsPage.tsx`, `prospects/MessageTemplatesSettings.tsx`, `ManageStagesModal.tsx`, `ManageLossReasonsModal.tsx` | M | rótulos acessíveis |
| `tests/leadImport.test.ts` | N | 20 testes do motor (Node) |
| `tests/ui/phase1bPipelineA11y.spec.tsx`, `phase1bProspectA11y.spec.tsx` | N | PIP-04/05/12 e Prospecção |
| `tests/ui/leadImportModal.spec.tsx`, `pipelinePage.spec.tsx`, `a11yBaseline.spec.tsx`, `leadsApiRepository.spec.ts`, `plannedFuturePhases.spec.tsx` | M | atualizados de propósito (ver `06`) |
| `tests/ui/support/setup.ts` | M | `localStorage` funcional nos testes |
| `docs/ux-redesign/fase-1b/*` e `fase-0-testes/02_MATRIZ_COBERTURA.md` | N/M | documentação |

Migrations: **nenhuma**. Dependências novas: **nenhuma**. Endpoints novos: **nenhum** (extensão aditiva do existente).
