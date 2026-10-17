# 05 — Arquivos alterados (Fase 1A)

Branch: `fix/gsm-crm-ux-phase-1a` (frontend), base `f4198860866721dec4cbc326d23555131bbd0773`. **Sem commit** (alterações no diretório de trabalho). `git diff --check`: limpo. Backend: **nenhum arquivo alterado**.

## Produção — componentes (6)

| Arquivo | + / − | Correções |
|---|---|---|
| `src/pages/PipelinePage.tsx` | +30 / −25 | PIP-01 |
| `src/components/common/PeriodFilter.tsx` | +2 / −0 | N-01 |
| `src/components/leads/LeadDrawer.tsx` | +28 / −7 | DRW-01 |
| `src/components/leads/LeadImportModal.tsx` | +172 / −141 (maior parte é reindentação ao entrar no `Modal`) | IMP-01, IMP-06, N-02, N-03, A-10 |
| `src/pages/SettingsPage.tsx` | +22 / −4 | CFG-06, CFG-02 (tag), CFG-03 |
| `src/components/leads/LeadMessageTemplatesSettings.tsx` | +27 / −4 | CFG-07, CFG-02 (template) |

## Produção — estilos (14)

| Arquivo | + / − | Motivo |
|---|---|---|
| `src/styles/theme.css` | +6 / −2 | novo `--accent-text`; `--faint` (2 temas) — A-05, SYS-02 |
| `src/pages/PipelinePage.module.css` | +7 / −1 | `.cardMain` (PIP-01) e `--accent-text` |
| `src/components/calendar/AgendaGrid.module.css` | +2 / −2 | `--accent-text` |
| `src/components/common/EmptyState.module.css` | +1 / −1 | idem |
| `src/components/common/Form.module.css` | +1 / −1 | idem |
| `src/components/common/HelpTip.module.css` | +1 / −1 | idem |
| `src/components/leads/LeadDrawer.module.css` | +1 / −1 | idem |
| `src/components/prospects/ProspectionBoard.module.css` | +2 / −2 | idem |
| `src/layouts/AppLayout.module.css` | +3 / −3 | idem (área `.theme-dark`: valor inalterado) |
| `src/layouts/AuthLayout.module.css` | +2 / −2 | idem |
| `src/pages/AgendaPage.module.css` | +1 / −1 | idem |
| `src/pages/ProfilePage.module.css` | +3 / −3 | idem |
| `src/pages/TasksPage.module.css` | +1 / −1 | idem |
| `src/styles/global.css` | +1 / −1 | idem |

## Testes (6 modificados; nenhum criado)

| Arquivo | + / − |
|---|---|
| `tests/ui/a11yBaseline.spec.tsx` | +59 / −21 |
| `tests/ui/leadImportModal.spec.tsx` | +90 / −6 |
| `tests/ui/settingsPage.spec.tsx` | +91 / −6 |
| `tests/ui/leadDrawer.spec.tsx` | +22 / −0 |
| `tests/ui/sharedComponents.spec.tsx` | +10 / −0 |
| `tests/ui/pipelinePage.spec.tsx` | +4 / −3 |

## Documentação (nova, não rastreada)

`docs/ux-redesign/fase-1a/01..07_*.md`.

## Fora do diff (confirmado)

`services/`, `repositories/`, `types/`, `auth/`, `routes/`, `package.json`, `package-lock.json`, `vitest.config.ts`, backend inteiro, migrations, deploy, `.env`.
