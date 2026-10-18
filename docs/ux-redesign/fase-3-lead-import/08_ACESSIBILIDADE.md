# 08 — Acessibilidade (WCAG 2.2 AA)

## O que foi **medido** (navegador real, Playwright + axe-core)

`e2e/a11y-lead-import.spec.ts`: **16 testes, 0 violações das regras fixas** (inclui `color-contrast`, `button-name`, `label`, `select-name`, `aria-dialog-name`, `aria-required-*`, `nested-interactive`, `list/listitem`, `scrollable-region-focusable`), em **4 resoluções × 2 temas**:

| Tela | Estados auditados |
|---|---|
| Painel do lead | leitura; edição com erro de validação visível |
| Assistente de CSV | Arquivo · Colunas · Revisão · Resultado (cada um em 8 combinações) |

Relatórios JSON em `e2e/.artifacts/axe-*.json` (não versionados). A auditoria **achou 1 problema real** durante a fase — o selo "obrigatório" da etapa Colunas tinha contraste insuficiente no tema claro (`--accent-text` sobre `--accent-bg`); corrigido com `--accent-soft` e reexecutado.

## Verificado por teste funcional (jsdom e/ou navegador)

| Requisito | Como |
|---|---|
| Diálogo do painel: papel, nome "Lead <nome>", `aria-modal` | testes de UI + E2E |
| Foco inicial, foco preso, **retorno do foco** ao abrir/fechar | `useDialog` (testes F-13) |
| Esc e clique fora **não** descartam trabalho em andamento; só o botão, com confirmação | UI + E2E |
| Diálogos empilhados: Esc fecha só o do topo | teste F-20 |
| Campos com `label`/`htmlFor`; obrigatório com `aria-required`; erro com `aria-invalid` + `aria-describedby` + `role="alert"` | UI + E2E (foco vai ao primeiro inválido) |
| Indicador de etapas: `ol`, `aria-current="step"`, texto "Concluída/Etapa atual" | UI |
| Progresso: `<progress>` com nome, valor e máximo reais; texto `role="status"` com "N de M linhas (X%)" | UI + E2E |
| Erro de importação anunciado **uma** vez (`role="alert"`) | UI (A-10) |
| Tabela de mapeamento: cada `select` com nome "Campo do lead para a coluna X" | UI |
| Lista de problemas do resultado rolável com **foco por teclado** (`tabindex=0`, região nomeada) | axe (`scrollable-region-focusable`) |
| Alvos de toque ≥ 32 px (fechar 40, ações 36) | desenho + E2E de celular |
| Não depender só de cor: tipo do evento em texto; erro com texto; "obrigatório" com texto; atraso com "Atrasada ·" | UI |

## Não feito / não declarado como testado

- **Leitor de tela real (NVDA/JAWS/VoiceOver): NÃO executado.** Os atributos e a árvore estão corretos para os testes automatizados, mas isso não substitui validação com leitor de tela (R1 em `12`).
- Navegação por teclado foi exercitada em Playwright (Tab/Esc/Enter) apenas nos fluxos listados; não houve teste com tecnologia assistiva de voz/switch.
- Contraste auditado no painel e no assistente; demais telas ficam para o Prompt 08.
- `prefers-reduced-motion`: o painel mantém a animação de entrada herdada (`gsmFade`, 0,2 s); não foi alterada nesta fase.
