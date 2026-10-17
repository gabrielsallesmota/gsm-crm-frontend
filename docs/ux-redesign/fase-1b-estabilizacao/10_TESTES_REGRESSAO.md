# 10 — Testes de regressão

## Resultados finais (2026-10-17, ambiente local isolado)

| Verificação | Antes (fim da 1B) | Agora |
|---|---|---|
| Backend `pytest` (suíte completa, Postgres real) | 2.689 passam, 7 ignorados | **2.722 passam, 7 ignorados, 0 falhas** (+33) |
| Backend `ruff` / `black --check` / `mypy app` | limpos | **limpos** (618 arquivos; 384 fontes) |
| Frontend `eslint .` (inclui `e2e/`) | limpo | **limpo** |
| Frontend `tsc -b` (inclui `tsconfig.e2e.json`) | limpo | **limpo** |
| Frontend `npm run build` | ok | **ok** |
| Frontend Node (`npm run test:unit`) | 259 | **264** (+5) |
| Frontend Vitest | 405 passam, 19 `todo` | **422 passam, 19 `todo`** (+17) |
| **E2E Playwright** | — | **135 testes: 134 passam, 1 pulado (manual, executado à parte e passou), 0 falhas** |

## Testes adicionados nesta estabilização

| Camada | Arquivo | Qtde | Cobre |
|---|---|---|---|
| Backend | `test_import_concurrency_stabilization.py` | 10 | R1 (corrida), duplicação intencional, lock por tenant, espera estourada, reserva assumida |
| Backend | `test_import_security_stabilization.py` | 10 | suporte (leitura/elevada), staff, IDs de outro tenant, vendedor, chave entre tenants/usuários |
| Backend | `test_import_idempotency_window_stabilization.py` | 5 | TTL de 24 h e bordas |
| Backend | `test_import_poison_rows_stabilization.py` | 8 | limites de coluna por linha |
| Node | `leadImport.test.ts` | +5 | janela de retomada, limites de coluna |
| Vitest | `leadImportModal.spec.tsx` | +17 | R4 (14), sair da tela (1), demais ajustes |
| **E2E** | `pipeline` 22 · `import` 33 · `security` 8 · `a11y-visual` 24 · `smoke` 1 · `restart` 1 | **135** (89 Chromium + 23 Firefox + 23 WebKit) | ver `03`/`04` |

## Defeitos que os testes pegaram (e foram corrigidos)

1. Corrida entre importações (R1) — falhava com 298 leads em vez de 150 antes do lock.
2. Linha venenosa (500 no lote) — 7 testes falhavam antes da validação por linha.
3. Foco do seletor "mover" sem contorno (E2E, navegador real).
4. Janela de retomada renovada / evidência apagada (R4).
5. Importação invisível ao sair da tela.
6. **Teste instável pré-existente** `test_publish_event_without_a_lead_and_replay_with_the_same_key` (`test_connections_api.py`): gerava o corpo do evento duas vezes com `datetime.now()` em segundos, então o 2º envio virava "outro corpo" (422) quando o relógio virava o segundo entre as chamadas. Falhava **também no commit da 1B** (comprovado com `git stash`). Corrigido no **teste** (corpo gerado uma vez); nenhum código de produção alterado.

## Regressões

Nenhuma nova. Todos os testes que existiam continuam passando. Os testes de caracterização alterados na 1B permanecem como estavam (justificativas em `fase-1b/06`).

## Observação sobre números anteriores

`fase-1b/06_TESTES_REGRESSAO.md` informa "405 passam, 12 `todo`" no Vitest; o `todo` total é **19** (7 de acessibilidade + 12 planejados). Correção só de texto.

## O que os testes automatizados NÃO provam

Leitor de tela real; arrastar com toque real; comportamento em homologação/produção; carga com muitas importações grandes simultâneas (`04`, seção NÃO EXECUTADO).
