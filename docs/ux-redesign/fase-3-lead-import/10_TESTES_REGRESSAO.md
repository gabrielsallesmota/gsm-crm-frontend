# 10 — Testes e regressão

## Resultado final

| Verificação | Resultado |
|---|---|
| ESLint (frontend, `e2e/` incluído) | limpo |
| TypeScript (`tsc -b` + `tsconfig.e2e.json`) | limpo |
| Build | ok — JS principal **413,4 kB** (gzip 127,2 kB), +19,9 kB (+5 %) sobre os 393,5 kB do Prompt 06 (painel, assistente e utilitários novos; sem dependência nova) |
| Unitários Node (`npm run test:unit`) | **288 passam** (284 → +4: `leadForm`, `timelineKind`) |
| UI Vitest | **458 passam** (449 → +9), 19 `todo` herdados, 0 falhas |
| E2E Playwright, 3 navegadores (rodada completa final) | **192 passam · 1 intermitente · 1 ignorado** de 194 (25,7 min) |
| axe-core (painel + 5 etapas × 4 resoluções × 2 temas) | **0 violações** das regras fixas (16 testes) |
| Backend pytest (suíte completa, com o middleware) | **verde, sem falhas** (100 %) |
| Backend lint/tipos (`ruff`, `mypy app`) | limpos |

O "ignorado" é `restart.spec.ts` (reinício REAL do backend), que só roda manualmente (`E2E_ALLOW_RESTART=1` com servidores externos) — **não foi reexecutado nesta fase**; a retomada está coberta pelos demais testes de importação.

**Intermitência (1):** em uma rodada, `lead-drawer › timeline longa` estourou o *timeout* de 180 s esperando o campo de e-mail da **tela de login** (infraestrutura do ambiente, antes de qualquer tela desta fase). Passou 2/2 em reexecução isolada. Na rodada anterior (primeira completa) houve também um logout inesperado após `page.reload()` em `import › recarregar a página…` e uma falha de `2001 registros`, ambos passando em reexecução. Não foram investigadas a fundo: ficam como risco de estabilidade do ambiente E2E (login sob carga), não do código desta fase.

## Falhas encontradas e tratadas durante a fase

| Achado | Causa | Tratamento |
|---|---|---|
| 61 testes de UI do importador falharam | fluxo agora em etapas (o "Importar" fica na revisão) | helper `toReview()`/`inReview()`; **nenhum teste removido** (67 → 73) |
| 4 testes do drawer falharam | mudanças **deliberadas**: descartar pede confirmação; "perdido" pede confirmação (D-03); responsável aparece também no cabeçalho | testes atualizados + novos casos (ganho não pede; recusar mantém; cancelar sem alterações sai direto) |
| 2 testes `a11yBaseline` (A-10, N-03) | etapa extra / botão bloqueado agora é "Continuar" | ajustados mantendo a intenção |
| E2E importação (7 na 1ª rodada) | `Válidas: 1` virou número em bloco (regex com `\b`), botão Importar inexistente fora da revisão, texto "Cancelar importação" | helpers e regexes (`(?!\d)`), `interruptImport()` |
| axe: contraste do selo "obrigatório" (tema claro) | `--accent-text` sobre `--accent-bg` | `--accent-soft` |
| E2E do painel: `getByLabel("E-mail")` ambíguo | o botão "Escrever e-mail para…" casa por substring | `exact: true` |
| `Api.comment` repetia em 404 | mascarava o bug do 404 | retentativa **removida**; o E2E agora protege a correção |

## Testes novos

| Camada | Arquivo | Cobre |
|---|---|---|
| Node | `tests/leadForm.test.ts` | validação, "sujo", `tel:`, `timelineKind` |
| UI | `tests/ui/leadDrawer.spec.tsx` (+4) | descartar, validação por campo, perdido com/sem confirmação |
| UI | `tests/ui/leadImportModal.spec.tsx` (+6) | indicador de etapas, Voltar, colunas ignoradas, ajuda de duplicados, interromper com confirmação |
| E2E | `e2e/lead-drawer.spec.ts` (7) | fluxo comercial completo @cross, descartar, perdido, validação, "Ver mais", celular, **404 sob concorrência** |
| E2E | `e2e/a11y-lead-import.spec.ts` (16) | axe + sem rolagem horizontal |
| E2E | `e2e/visual-evidence-lead-import.spec.ts` (4) | capturas |
| Backend integração | `test_read_after_write_visibility.py` (3) | servidor real, 2 conexões: natural, concorrência, commit lento |
| Backend unitário | `test_commit_before_response.py` (4) | segura/solta o corpo, falha após resposta, streaming grande, escopos não-HTTP |

## Regressão do que existia

Pipeline (redesign do Prompt 06: 34 E2E), ordenação, paginação, arraste, filtros, segurança multi-tenant (`security.spec.ts`), importação (500/501/2.000/10.000/10.001, duplicados, falha parcial, concorrência de abas, janela de retomada) — **todos verdes** na rodada completa final, exceto o item intermitente acima.

## Segurança multi-tenant

Sem mudança de backend de dados. `security.spec.ts` (isolamento entre tenants, papéis, sessão de suporte) verde. O middleware novo é agnóstico a tenant e não toca em autenticação.
