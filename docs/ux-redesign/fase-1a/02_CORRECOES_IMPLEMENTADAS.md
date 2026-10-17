# 02 — Correções implementadas (Fase 1A)

IDs idênticos aos da Auditoria 01 e da Fase 0. Tabela de planejamento (feita antes de codar) e, depois, o detalhe de cada correção.

## Plano → resultado

| ID | Componente / arquivo | Teste atual (Fase 0) | Correção mínima | Risco | Teste de aceite | Resultado |
|---|---|---|---|---|---|---|
| PIP-01 | `KanbanCard` — `pages/PipelinePage.tsx` | `a11yBaseline` `it.fails` PIP-01 | contêiner neutro arrastável + `role="button"` só no resumo; mover/WhatsApp/e-mail como irmãos | médio (DnD/estrutura) | `[CORRIGIDO 1A PIP-01]` + pipeline 43 | ✔ |
| N-01 | `common/PeriodFilter.tsx` | `it.fails` N-01 | `aria-label` nas duas datas | baixo | `[CORRIGIDO 1A N-01]` + `sharedComponents` | ✔ |
| DRW-01 | `leads/LeadDrawer.tsx` | `it.fails` DRW-01 | `aria-labelledby` ligando rótulo e campo (6 campos) | baixo | `[CORRIGIDO 1A DRW-01]` + teste de salvamento por rótulo | ✔ |
| IMP-01 | `leads/LeadImportModal.tsx` | `it.fails` ×2 | usar `Modal` compartilhado; bloquear fechamento durante o envio | médio (CSS/largura) | 2 `[CORRIGIDO 1A IMP-01]` + 4 testes de importação | ✔ |
| IMP-06 | idem | `it.fails` IMP-06 | `<label htmlFor>` nos 3 selects de parâmetros e `aria-label` por coluna no de/para | baixo | `[CORRIGIDO 1A IMP-06]` + teste dedicado | ✔ |
| N-02 | idem | `it.fails` N-02 | `aria-label` no seletor de arquivo | baixo | `[CORRIGIDO 1A N-02]` | ✔ |
| N-03 | idem | `it.fails` N-03 + caracterização | explicação `role="status"` + `aria-describedby` no botão | baixo | `[CORRIGIDO 1A N-03]` + 2 testes | ✔ |
| A-10 | idem | `it.fails` A-10 | `role="alert"` na mensagem de erro (uma só região) | baixo | `[CORRIGIDO 1A A-10]` + teste de unicidade | ✔ |
| CFG-06 | `pages/SettingsPage.tsx` | `it.fails` CFG-06 | `aria-label` nos campos de pipeline, etapa e tag | baixo | `[CORRIGIDO 1A CFG-06]` + teste dedicado | ✔ |
| CFG-07 | `leads/LeadMessageTemplatesSettings.tsx` | `it.fails` CFG-07 | `aria-label` em etapa, origem e mensagem | baixo | `[CORRIGIDO 1A CFG-07]` | ✔ |
| CFG-02 | `SettingsPage.tsx` (tag), `LeadMessageTemplatesSettings.tsx` (template) | 2 caracterizações "sem confirmação" | `ConfirmDialog` reutilizado; mesma operação de exclusão | baixo | 4 testes de tag + 3 de template | ✔ |
| CFG-03 | `SettingsPage.tsx` | caracterização (mensagem não citava templates) | frase extra na confirmação | baixo | teste atualizado | ✔ |
| A-05 | `styles/theme.css` | `it.fails` A-05 | `--faint` mais escuro (claro) / mais claro (escuro) | baixo-médio (visual global em 5 usos) | `[CORRIGIDO 1A A-05]` | ✔ |
| SYS-02 | `theme.css` + 13 arquivos CSS | `it.fails` SYS-02 | novo token `--accent-text`; os 20 usos de `color: var(--accent)` (13 arquivos) passam a usá-lo | médio (visual) | `[CORRIGIDO 1A SYS-02]` + varredura de CSS | ✔ |

---

## PIP-01 — Controles interativos aninhados no cartão
- **Antes**: o cartão inteiro era `role="button"` (`tabIndex=0`, `onClick`, `onKeyDown`) e continha `<select>`, link de WhatsApp e link de e-mail.
- **Depois**: o cartão é um `<div>` neutro (`draggable`, `aria-busy`) com **três filhos irmãos**: o resumo (`div role="button"` com nome "Abrir {lead}", só texto dentro), o seletor "Mover…" e os botões de contato. Clique, Enter e Espaço abrem o lead; arrastar continua pelo contêiner; `stopPropagation` do seletor deixou de ser necessário.
- **Arquivos**: `src/pages/PipelinePage.tsx`, `PipelinePage.module.css` (`.cardMain`).
- **Testes**: `a11yBaseline [CORRIGIDO 1A PIP-01]` (zero interativos dentro do botão **e** irmãos presentes — não é vacuoso); `pipelinePage` (43, com 3 ajustes para o novo contêiner); arrastar, teclado e cliques internos seguem cobertos.
- **Risco residual**: arrastar real no navegador (Firefox/toque) não foi exercitado — MANUAL; o cursor do resumo agora é "pointer" (antes "grab" no cartão todo).

## N-01 — Datas do filtro de período
- **Antes**: dois `input[type=date]` sem nome. **Depois**: `aria-label` "Período: data inicial" e "Período: data final". Filtro por **data de criação**, presets e contrato inalterados.
- **Arquivos**: `src/components/common/PeriodFilter.tsx`. **Testes**: `[CORRIGIDO 1A N-01]`, `sharedComponents N-01`. **Risco**: nenhum conhecido (afeta Pipeline, Leads e Dashboard, só nomes).

## DRW-01 — Campos do painel do lead
- **Antes**: Valor, Probabilidade, Telefone, E-mail, Origem e Notas sem nome acessível. **Depois**: cada rótulo visível ganhou `id` (via `useId`) e o campo `aria-labelledby` correspondente; **nenhuma mudança visual**, validações, salvamento, permissões e estados de edição intactos.
- **Arquivos**: `src/components/leads/LeadDrawer.tsx`. **Testes**: `[CORRIGIDO 1A DRW-01]`; `leadDrawer` "todos os campos editáveis são encontrados pelo rótulo e o salvamento leva os valores digitados". **Risco**: baixo.

## IMP-01 / IMP-06 / N-02 / N-03 / A-10 — Importação de leads
- **Antes**: overlay próprio sem papel de diálogo, foco, Esc nem proteção; selects e arquivo sem nome; botão desabilitado sem explicação; erro como texto simples.
- **Depois**:
  - **IMP-01**: usa o `Modal` compartilhado — `role="dialog"`, `aria-modal`, nome "Importar leads via CSV", foco preso e **devolvido** a quem abriu, Esc. Enquanto importa, `onClose` é neutralizado (Esc, fundo, × e Cancelar não fecham). Após escolher arquivo/mudar um campo, Esc e clique no fundo **não descartam** (regra do `Modal`); só Cancelar/Fechar.
  - **IMP-06**: `<label htmlFor>` nos selects de etapa, responsável e duplicados; `aria-label="Campo do lead para a coluna {cabeçalho}"` em cada de/para.
  - **N-02**: `aria-label="Arquivo CSV com os leads"`.
  - **N-03**: sem coluna Nome → "Nome é obrigatório: associe uma coluna do arquivo ao campo Nome para importar."; com Nome mapeado mas todas as linhas sem nome → "Nenhuma linha pode ser importada: todas estão sem nome." (`role="status"`, ligado ao botão por `aria-describedby`). **O envio inválido continua impedido** (botão desabilitado).
  - **A-10**: `role="alert"` na mensagem de erro; uma única região (sem anúncio duplicado — o erro não vira toast).
  - Regra de validação, contrato, dedupe, limites e dono **inalterados**.
- **Arquivos**: `src/components/leads/LeadImportModal.tsx`. **Testes**: 5 `[CORRIGIDO 1A …]`; `leadImportModal` (40); foco devolvido, Esc/fundo antes e depois de escolher arquivo, bloqueio durante o envio.
- **Risco residual**: largura do diálogo 560 px (era 640 px) — conferir a tabela de de/para em tela real; `ProspectImportModal` (Prospecção) **não** foi tocado e segue com overlay próprio.

## CFG-06 / CFG-07 — Rótulos em Configurações
- **Antes**: nome do pipeline/etapa/tag e formulário de template só com `placeholder`. **Depois**: `aria-label` em "Nome do novo pipeline", "Nome do pipeline", "Nome da etapa", "Nome da nova etapa", "Nome da nova tag", "Etapa do template", "Origem do template", "Mensagem do template". Formulários, validações, precedência, placeholders e salvamento inalterados.
- **Arquivos**: `SettingsPage.tsx`, `LeadMessageTemplatesSettings.tsx`. **Testes**: `[CORRIGIDO 1A CFG-06]`, `[CORRIGIDO 1A CFG-07]`, `settingsPage` "campos … têm nome acessível". **Fora**: campos dos estágios/mensagens de **Prospecção** (área interna) não foram tocados.

## CFG-02 — Confirmação ao excluir tag e template
- **Antes**: a exclusão ocorria no clique. **Depois**: `ConfirmDialog` (o mesmo componente já usado em etapas/pipelines): tag → "Remover tag?" citando a tag; template → "Excluir template?" citando **etapa, origem e mensagem** e explicando o efeito (usa o padrão da etapa ou abre em branco). Cancelar/Esc não chamam nenhuma API; confirmar chama **exatamente a mesma operação de antes**; sucesso só aparece depois da resposta; erro mantém o diálogo e avisa. Foco volta ao botão de origem.
- **Arquivos**: `SettingsPage.tsx`, `LeadMessageTemplatesSettings.tsx`. **Testes**: 4 (tag) + 3 (template). **Risco**: baixo.

## CFG-03 — Aviso na exclusão de etapa
- Mensagem acrescida: "Os templates de mensagem de WhatsApp cadastrados para esta etapa também serão excluídos." A regra de cascata do backend e a recusa de etapa com leads **não mudaram**; não há remanejamento. **Teste**: `settingsPage CFG-03`.

## A-05 e SYS-02 — Contraste
- **A-05**: `--faint` escuro `#5f6b76 → #78848f`; claro `#8d98a3 → #66717c` (usos: "Sem leads", rótulo do painel, Prospecção, login).
- **SYS-02**: novo token `--accent-text` (escuro = `#2ee66e`, igual ao acento; claro = `#0b7a38`). Os 20 `color: var(--accent)` de texto em 13 arquivos CSS passaram a `var(--accent-text)`. Fundos e bordas continuam com `--accent` (identidade preservada). Áreas `.theme-dark` (menu lateral, login) mantêm o verde neon.
- Tabela antes/depois em `04_ACESSIBILIDADE.md`. **Testes**: `[CORRIGIDO 1A A-05]`, `[CORRIGIDO 1A SYS-02]`, 2 de proteção (identidade do verde; nenhum CSS volta a usar `--accent` como texto).

## Correções **não** implementadas (justificativa)
| ID | Motivo |
|---|---|
| PIP-04 (reordenar colunas por teclado) | fora do escopo autorizado da 1A; depende do redesign do cabeçalho de coluna (Fase 2). O `it.fails` permanece. |
| Campos sem rótulo na Prospecção (área interna GSM) | fora do escopo; ver `06`. |
| Ordenação no servidor, lotes, pré-importação, `last_interaction_at`, painel, Kanban, permissões etc. | exclusões explícitas do prompt. |
