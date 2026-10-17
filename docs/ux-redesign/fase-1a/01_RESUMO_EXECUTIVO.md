# 01 — Resumo executivo — Fase 1A

## Marco A — validação da Fase 0: **APROVADO**

| Verificação | Resultado |
|---|---|
| Branch `test/gsm-crm-ux-safety-net` existe nos dois repositórios | Sim |
| Estado Git igual ao relatado | Sim (frontend: 1 arquivo modificado + arquivos novos; backend: 2 arquivos novos; nada staged) |
| `git diff --check` | limpo |
| Alterações limitadas a testes, apoio, configuração de testes e documentação | Sim — único arquivo não-teste modificado: `vitest.config.ts` (`setupFiles`, `testTimeout`); nenhuma alteração em código de produção, API, schema, migration, deploy, `.env` ou dependências |
| Segredos nos arquivos novos | nenhum encontrado |
| Testes críticos | frontend: lint, tipos, 239 Node + 350 Vitest, build; backend: black/ruff/mypy, **2654 passam, 14 pulados, 0 falhas** |
| `it.fails` falham pelo defeito esperado | Sim (revalidado) |
| `todo`/`skip` documentados | Sim |

**Revisão de qualidade (proporcional ao risco)** — encontrou **três fragilidades nos meus próprios testes**, corrigidas **antes** do commit:
1. `test_last_interaction_at_only_changes_when_the_lead_is_moved_today`: o passo "import-update não conta" era **vacuoso** (o lead não tinha telefone, então o import criava *outro* lead). Agora o lead tem telefone e o teste prova que o import atualizou **aquele** lead.
2. `test_vendedor_never_updates_or_sees_the_name…`: asserção tautológica (`… or strategy == "skip" and False`) substituída por asserção direta; agora também exige a mensagem "outro responsável".
3. `pipelinePage`: o teste "dois movimentos seguidos… recusado com aviso" prometia mais do que verificava; foi renomeado para o que de fato prova, e o teste de ações internas passou a clicar também no WhatsApp.
Também removido o fatiamento enganoso `[:3]` de uma parametrização.

### Commits da Fase 0 (sem push)

| Repositório | Hash completo | Mensagem |
|---|---|---|
| `gsm-crm-frontend` | `f4198860866721dec4cbc326d23555131bbd0773` | `test: establish GSM CRM UX regression safety net` (22 arquivos) |
| `gsm-crm-backend` | `1f965ea44f62b749d6df352af5009d3df9f3973b` | `test: establish GSM CRM UX regression safety net` (2 arquivos) |

Ficaram **fora** do commit (não pertencem à Fase 0): `docs-mapa-de-telas.md` e `docs/ux-redesign/auditoria-01/` (permanecem não rastreados).

## Marco B — Fase 1A: **CONCLUÍDA, aguardando revisão**

Branch: `fix/gsm-crm-ux-phase-1a` (frontend, a partir do commit `f4198860…` da Fase 0). **Nenhuma alteração no backend.** Nada commitado na Fase 1A.

| | Resultado |
|---|---|
| Correções implementadas | **14** (PIP-01, N-01, DRW-01, IMP-01, IMP-06, N-02, N-03, A-10, CFG-06, CFG-07, CFG-02, CFG-03, A-05, SYS-02) |
| `it.fails` convertidos em testes comuns | **13** (resta 1: `PIP-04`, fora do escopo da 1A) |
| Testes de caracterização alterados de propósito | 9 (lista em `03`) |
| Vitest | **365 passam** · 1 *expected fail* · 26 *todo* (antes: 350 passam incl. 14 *expected fail*) |
| Node (`test:unit`) | 239 passam |
| Lint · Typecheck · Build | limpos · limpos · OK |
| Contrato de API, regra comercial, permissões | **inalterados** |

Mudança visível ao usuário (intencional): importação passa a usar o diálogo padrão (um pouco mais estreito: 560 px em vez de 640 px; Esc fecha; clique no fundo/Esc **não** descartam depois que o arquivo é escolhido); exclusão de tag e de template pedem confirmação; confirmação de excluir etapa avisa dos templates; textos de baixo contraste ficaram mais legíveis (o verde do tema claro usado como texto escureceu).

Detalhes: `02` (correção por correção), `03` (testes), `04` (acessibilidade e contraste), `05` (arquivos), `06` (riscos/pendências), `07` (handoff).
