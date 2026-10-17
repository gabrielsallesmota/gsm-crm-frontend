# 07 — Handoff para a Fase 1B

## Estado de entrada

- Fase 0 commitada (sem push): frontend `f4198860866721dec4cbc326d23555131bbd0773`, backend `1f965ea44f62b749d6df352af5009d3df9f3973b`.
- Fase 1A: alterações **não commitadas** na branch `fix/gsm-crm-ux-phase-1a` (frontend). Para a 1B partir de base estável, **revisar e autorizar o commit da 1A** primeiro (sugestão de mensagem: `fix(a11y): fase 1A — rótulos, diálogo de importação, confirmações e contraste`).
- Suíte frontend verde: 239 Node + 365 Vitest (+1 *expected fail* `PIP-04`, 26 *todo*), lint, tipos e build limpos.

## Antes de começar a 1B

1. **Verificação manual** dos riscos R1–R4 de `06` (arrastar, cartão, diálogo de importação, cores nos dois temas).
2. Decidir R5 (hierarquia `--faint` × `--muted-2` no tema claro) e R8 (migrar `ProspectImportModal`).
3. Autorizar (ou não) dependência de desenvolvimento para **teste visual/e2e** (Playwright ou equivalente): sem ela, qualquer mudança de layout nas fases 2+ não tem rede.

## Candidatos naturais à Fase 1B (sem decisão de produto pendente)

| Item | Observação |
|---|---|
| PIP-04 / PIP-05 | menu "Mover…" por cartão e/ou "Mover coluna" acessível por teclado (converte o último `it.fails`) |
| PIP-12 | alvos ≥ 24 px (idealmente 44 px em toque) nos botões do cartão |
| IMP-02/IMP-03/IMP-04/IMP-07 | limite de 2.000 avisado **antes** de enviar, relatório de pré-importação, motivos das linhas ignoradas — **ficaram de fora da 1A por exclusão explícita** (não é lote; é aviso/relatório) |
| PIP-02 | ordenação no servidor (`sort_by` já aceito pela API) — exclusão explícita da 1A |
| DRW-05 | "ver mais" na timeline (parâmetro `limit` já existe) |
| `ProspectImportModal` | mesmas correções IMP-01/IMP-06 na área interna |
| Prospecção | rótulos dos campos |

## Itens que dependem de decisão (não iniciar sem aprovação)

D-01 (última interação), D-03 (confirmação/motivo de perda), D-05, D-10 (lotes), campos agregados do backend (B-1/B-2), reorganização do painel (D-07/D-08) e do Kanban/Configurações (Fases 2–4).

## Regras que continuam valendo

1. Rodar a suíte inteira antes e depois; testes de caracterização que mudarem devem ser alterados **de propósito**, com a razão no PR/documento.
2. Converter `it.fails` corrigidos em testes comuns no mesmo PR.
3. Não alterar contrato de API, permissões ou isolamento sem fase própria.
4. Atualizar `fase-0-testes/02_MATRIZ_COBERTURA.md` quando um item PARCIAL ganhar teste (F-03, F-11, F-16, F-34, F-35, F-36).

## Pontos de atenção técnica

- `tests/ui/support/setup.ts` fixa `asyncUtilTimeout = 4000`; testes que dependem de tempo devem usar `findBy`/`waitFor`.
- `renderApp` invalida o cache de leituras compartilhadas (`invalidateShared`); novos testes devem usá-lo.
- O `ToastHost` renderiza uma região `role="alert"` vazia: ao testar alertas, **procure dentro do diálogo** (`within(dialog)`), não no documento.
- Procure sempre pelos IDs da auditoria (PIP-, DRW-, IMP-, CFG-, N-, A-, SYS-) nos nomes dos testes.
