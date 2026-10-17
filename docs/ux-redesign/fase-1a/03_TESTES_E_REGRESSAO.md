# 03 — Testes e regressão (Fase 1A)

## Resultados finais (frontend; o backend não foi alterado)

| Verificação | Comando | Resultado |
|---|---|---|
| Lint | `npx eslint .` | limpo |
| Typecheck | `npx tsc -b` | limpo |
| Testes Node | `npm run test:unit` | **239 passam**, 0 falham |
| Testes de UI | `npx vitest run` | **365 passam · 1 *expected fail* (`PIP-04`) · 26 *todo*** (15 arquivos: 14 passam, 1 só com *todo*) |
| Build | `npm run build` | OK |
| Backend | — | **sem alteração na 1A**; última suíte completa (no gate da Fase 0): 2654 passam, 14 pulados, 0 falhas, com black/ruff/mypy limpos |

Comparação com a Fase 0: **350 passam (14 *expected fail*)** → **365 passam (1 *expected fail*)**; saldo +16 testes executados.

## `it.fails` convertidos em testes comuns (13)

| `it.fails` (Fase 0) | Teste comum agora | Observação |
|---|---|---|
| PIP-01 | `[CORRIGIDO 1A PIP-01]` | reforçado: confere que os irmãos (seletor e links) **existem** e estão **fora** do botão |
| DRW-01 | `[CORRIGIDO 1A DRW-01]` | |
| IMP-01 (papel de diálogo) | `[CORRIGIDO 1A IMP-01]` | |
| IMP-01 (Esc) | `[CORRIGIDO 1A IMP-01]` | |
| IMP-06 | `[CORRIGIDO 1A IMP-06]` | busca agora no `dialog` (antes, o pai do título) |
| A-10 | `[CORRIGIDO 1A A-10]` | **exige exatamente um** `role=alert` dentro do diálogo; antes acertava o alerta do toast |
| CFG-06 | `[CORRIGIDO 1A CFG-06]` | |
| CFG-07 | `[CORRIGIDO 1A CFG-07]` | |
| N-01 | `[CORRIGIDO 1A N-01]` | |
| N-02 | `[CORRIGIDO 1A N-02]` | |
| N-03 | `[CORRIGIDO 1A N-03]` | + exige `aria-describedby` no botão |
| A-05 | `[CORRIGIDO 1A A-05]` | agora também sobre `bg` (3 fundos × 2 temas) |
| SYS-02 | `[CORRIGIDO 1A SYS-02]` | passou a medir o token `--accent-text` |

Permanece `it.fails`: **PIP-04** (fora do escopo). Nenhum `skip` foi usado; nenhum teste foi enfraquecido.

## Testes de caracterização **alterados de propósito** (9) — mudança intencional de comportamento

| Teste (Fase 0) | Mudança | Por quê |
|---|---|---|
| `leadImportModal` "sem coluna Nome… SEM explicação" | agora exige a explicação (+ outro teste p/ "todas sem nome") | N-03 |
| `leadImportModal` "clicar no fundo FECHA e descarta…" | substituído por 4 testes: fecha só antes de escolher; **não** fecha depois; **não** fecha durante o envio; foco devolvido | IMP-01 |
| `leadImportModal` "texto do modal descreve de/para…" | busca agora dentro do `dialog` | estrutura do `Modal` |
| `pipelinePage` "enquanto o movimento está em voo…" | `aria-busy` está no contêiner do cartão | PIP-01 |
| `pipelinePage` "ações internas do cartão…" | consulta no contêiner (irmãos do botão) | PIP-01 |
| `pipelinePage` "links de contato…" | idem | PIP-01 |
| `settingsPage` "excluir etapa… (NÃO cita templates)" | agora **cita** os templates | CFG-03 |
| `settingsPage` "remover tag: DIRETO, sem confirmação" | 4 testes com confirmação | CFG-02 |
| `settingsPage` "excluir template: DIRETO, sem confirmação" | 3 testes com confirmação | CFG-02 |

## Testes adicionados (além das conversões)

- Importação: Esc/fundo antes e depois de escolher arquivo; bloqueio durante o envio; foco devolvido; rótulos de arquivo, parâmetros e de/para; erro anunciado uma vez; "todas sem nome".
- Painel do lead: edição por rótulo com payload de salvamento.
- Configurações: tag (cancelar, confirmar, erro, Esc+foco), template (cancelar, confirmar, erro), rótulos de pipeline/etapa/tag/template.
- Filtro de período: nomes das datas + filtragem.
- Contraste: faint e accent-text nos 3 fundos × 2 temas; verde de identidade preservado; varredura que impede `color: var(--accent)` em texto.

## Fluxos que continuam cobertos e passam (regressão)

Mover por arrastar/seletor, rollback, concorrência, reordenar etapas, filtros, paginação, abertura do painel por clique/Enter/Espaço, edição/salvamento do lead, tarefas, comentários, exclusão com confirmação, WhatsApp (precedência e sem template), importação (mapeamento, duplicados, volumes 1/500/2.000/2.001/10.000 em chamada única, resumo, erros), pipelines/etapas/tags/templates, guards de rota e permissões.

## Verificação do diff (revisão)

`git diff --check` limpo; só frontend; arquivos de produção tocados limitam-se aos 6 TSX, 13 CSS e o arquivo de tokens (`theme.css`) listados em `05`. Nenhuma alteração em `services/`, `repositories/`, `types/` ou `auth/` (portanto nenhum contrato de API ou permissão mudou).

## Lacuna de verificação

Não há teste visual/e2e: o efeito real dos tokens de cor, do novo contêiner do cartão, da largura do diálogo de importação e do arrastar no navegador **não foi exercitado** (ver `06`).
