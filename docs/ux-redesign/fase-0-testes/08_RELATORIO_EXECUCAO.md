# 08 — Relatório de execução

Data: 2026-10-17. Máquina local (Windows 11, Node ≥ 22, Python 3.13), Postgres e Redis de teste locais. **Nenhum teste tocou dados reais, serviços externos, n8n ou WhatsApp.**

## Estado do Git

| Repositório | Branch de trabalho | Base | Estado |
|---|---|---|---|
| `gsm-crm-frontend` | `test/gsm-crm-ux-safety-net` | `main` @ `213d52d` (limpa; só havia documentos não rastreados da Auditoria 01) | alterações **não commitadas** |
| `gsm-crm-backend` | `test/gsm-crm-ux-safety-net` | `main` @ `14c2b7d` (limpa) | alterações **não commitadas** |

Nenhum commit, push, deploy ou merge. Nenhuma alteração pré-existente foi sobrescrita.

## Comandos e resultados

### Frontend (`gsm-crm-frontend`)

| Comando | Resultado |
|---|---|
| `npx eslint .` | **limpo** (0 erros, 0 avisos) |
| `npx tsc -b` (typecheck: app, node, testes, testes de UI) | **limpo** |
| `npm run test:unit` (`node --test "tests/**/*.test.ts"`) | **239 passam**, 0 falham (inclui 19 novos de `csvParser`) |
| `npm run test:ui` (`vitest run`) | **350 passam** · 0 falham · **14 `expected fail`** (falhas conhecidas, verdes por desenho) · **26 `todo`** (7 manuais + 19 planejados). Detalhe: 14 arquivos passam, 1 só com `todo` |
| `npm run build` (`tsc -b && vite build`) | **OK** (bundle ≈ 364 kB, 111 kB gzip) |

Execução de **um arquivo isolado** e da suíte inteira concordam. Um teste apresentou falha **intermitente sob carga** (o backend rodava em paralelo) e foi estabilizado com `asyncUtilTimeout: 4000` e `testTimeout: 20000` (arquivo de setup, sem tocar produção).

### Backend (`gsm-crm-backend`)

| Comando | Resultado |
|---|---|
| `black --check app tests alembic` | 609 arquivos sem mudanças |
| `ruff check app tests alembic` | **All checks passed** |
| `mypy app` | **Success: no issues found in 383 source files** |
| `pytest -q` (suíte completa, 15 min) | **2654 passam · 14 skipped (os planejados) · 0 falhas** — antes da fase eram 2611 (+43 novos) |

## Contagens desta fase

| Item | Quantidade |
|---|---|
| Arquivos de teste **criados** | 12 (10 frontend + 2 backend) — `csvParser.test.ts`, 9 `*.spec.tsx` (inclui `plannedFuturePhases`), `test_ux_safety_net.py`, `test_planned_future_phases.py` |
| Arquivos de apoio criados | 2 (`tests/ui/support/harness.tsx`, `setup.ts`) |
| Arquivos de teste **modificados** | **0** |
| Arquivo de configuração modificado | 1 (`vitest.config.ts`: `setupFiles`, `testTimeout`) |
| Testes **executados** adicionados | **305** = frontend 262 (243 Vitest + 19 Node) + backend 43 |
| Testes planejados (não verdes) | 40 = 26 `it.todo` + 14 `skip` |
| Dependências adicionadas/alteradas | **nenhuma** |
| Código de produção alterado | **nenhum** (`git diff` mostra só `vitest.config.ts`; o resto são arquivos novos de teste e documentação) |

## Validação dos testes de "falha conhecida"

As 14 `it.fails` foram executadas **como testes comuns** numa cópia temporária (removida) para confirmar que cada uma falha pela **assertiva do defeito** e não por erro de seletor. Uma (`A-10`) foi reforçada porque acertava o `role="alert"` do **toast**, não da linha de erro: agora a busca é restrita ao diálogo da importação.

## Limitações

1. jsdom não avalia CSS nem layout: responsividade, alvos de toque e `@media` são MANUAIS.
2. Eventos de arrastar são sintéticos; comportamento real do navegador não foi exercitado.
3. Sem leitor de tela, zoom, dispositivo real ou ferramenta automática de acessibilidade (axe) — não adicionada para evitar dependência nova.
4. Importação com milhares de linhas foi testada com **fixtures em memória** (10.000 linhas no parse e no envio simulado); o tempo real no navegador não foi medido.
5. Telas de Automações, Notificações, Integrações e Prospecção/SDR não ganharam testes novos (fora do escopo).
6. O app não foi aberto contra o ambiente real; todos os testes usam serviços substituídos (frontend) ou o banco de teste (backend).
7. Os 2.000 registros do backend rodam em ~1 minuto no banco local; em CI mais lento esse teste pode dominar o tempo da suíte.

## Falhas pré-existentes

Nenhuma. A suíte já existente continuou verde (2611 backend; frontend 239 − 19 = 220 Node e 107 Vitest anteriores).
