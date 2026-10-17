# 06 — Testes e regressão

## Resultado final (2026-10-17)

| Verificação | Resultado |
|---|---|
| Backend `pytest` (suíte completa) | **2689 passaram, 7 skipped**, 0 falhas (11 min 37 s) |
| Backend `ruff check` / `black --check` / `mypy app` | limpos (612 arquivos formatados; 383 fontes sem erro) |
| Frontend `eslint .` | limpo |
| Frontend `tsc -b` | limpo |
| Frontend testes unitários (Node) | **259 passam** (antes 239) |
| Frontend Vitest | **405 passam, 12 todo** (antes 365 passam + 1 *expected fail* + 26 todo) |
| Frontend `npm run build` | ok |

## Testes adicionados

- Backend: **35** em `test_import_batches_and_sorting_1b.py` (já com parametrizações): lotes ≤ 500, dedupe entre lotes nas 3 estratégias, replay idempotente, sem chave = comportamento anterior, corpo diferente (422), chaves inválidas, escopo usuário/tenant, falha libera a chave, concorrência, reserva presa expira, 409, falha parcial preserva lotes, `reason` por linha, auditoria sem PII, permissões, paginação com empates (5 campos × 2 direções), nulos no fim, ordenação global, filtros/escopo.
- Frontend Node: **20** em `leadImport.test.ts`.
- Frontend UI: `phase1bPipelineA11y` (PIP-04/05/12), `phase1bProspectA11y` (6), novos casos em `leadImportModal` (lotes 1/500/501/2000/2001/10000, 10001 e 5 MB bloqueados, progresso, 422/403 sem retry, 500/rede com a mesma chave, falha parcial + retomar só o faltante, cancelar, `beforeunload`, retomada após "recarregar"), `pipelinePage` (ordenação), `leadsApiRepository` (header e `reason`).
- Saldo UI: +40 passando; −26 → −12 `todo` (os 14 cenários D-10 planejados foram removidos por terem sido implementados) e o último `it.fails` virou teste comum.

## Testes de caracterização alterados DE PROPÓSITO

| Teste anterior | Mudança | Razão |
|---|---|---|
| IMP "1/500/2000/2001/10000 numa só chamada, sem aviso" | lotes de 500; 10001 bloqueado | D-10 |
| IMP "linhas sem nome saem em silêncio" | aparecem na pré-importação | sem descarte silencioso |
| IMP "origem desconhecida descartada em silêncio" | vira aviso | idem |
| IMP "Importando…"/"Linhas processadas:"/falha com lote único | progresso, categorias, estado "Falhou" + Retomar | novo fluxo |
| IMP "motivo das ignoradas não é exibido" (IMP-07) | exibido por linha | relatório |
| PIP "ordenação é APLICADA NO CLIENTE" | ordenação no servidor | PIP-02 |
| A11Y `it.fails` PIP-04 | teste comum | corrigido |
| A11Y A-10 / N-03 | mensagem de falha é ApiError não repetível; aviso de "Nome obrigatório" não duplica | novo fluxo |
| PLN D-10 (front e back) | removidos | implementado |

## Observações

- O `localStorage` do Node 25 lança sem `--localstorage-file`; `setup.ts` instala um armazenamento em memória e o limpa a cada teste.
- Não foi feito teste em navegador real; verificações manuais em `09`.
