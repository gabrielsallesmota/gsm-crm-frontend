# 11 — Design System: auditoria final

Auditoria por **leitura dos módulos CSS** e por **axe** (contraste) em 4 resoluções × 2 temas nas telas redesenhadas: Pipeline (Prompt 06), painel do lead e assistente de CSV (Prompt 07), Configurações e diálogo de "perdido" (Prompt 08). Nenhuma segunda identidade visual foi criada; **nenhum token novo**.

## Tokens (`styles/theme.css`)

| Verificação | Resultado |
|---|---|
| Cores em hexadecimal/`rgba()` nos módulos redesenhados (pipeline/*, `LeadDrawer`, `ImportWizard`, `Settings`, `PipelinePage`, `FilterChip`) | **0** (todas por token) |
| Tamanho de fonte por token (`--fs-*`) | **100 %** nos módulos novos; `Settings.module.css` (legado migrado) e `MessageTemplatesSettings.module.css` foram **convertidos nesta fase** (havia 13 e ~6 valores em `px`, inclusive abaixo do piso de 12 px: 11 e 11,5 px) |
| Piso tipográfico 12 px | cumprido nas telas redesenhadas |
| Espaçamento/raios/camadas | tokens (`--space-*`, `--radius-*`, `--z-*`) |

## Componentes compartilhados

| Componente | Estado | Observação |
|---|---|---|
| `Button` | consistente (`primary` / `ghost` / `danger`) | **corrigido**: `danger` agora passa de 4,5:1 no tema claro (afeta todos os diálogos de exclusão) |
| `Badge` | consistente | "Padrão" passou a usar tokens do tema; selos de dados continuam usando `readableTextColor` |
| `Modal` / `ConfirmDialog` | consistente | `Modal size="wide"` (Prompt 07); confirmações padronizadas, `ConfirmLostDialog` única fonte da D-03 |
| `EmptyState`, `FilterChip`, `Avatar`, `CurrencyInput`, `Icons` | consistentes | — |
| `SettingsCard` / `SettingsNav` | novos, só tokens | cartão de seção reutilizável |
| Campos de formulário | **três "dialetos"** coexistem: `LeadEditForm` (rótulo visível + erro inline), Configurações (`aria-label` + campo em linha) e telas legadas (`Form.module.css`) | padronizar é **P3** (não alterado: risco de regressão em muitas telas) |
| Skeletons / loading | `Skeleton` + "Carregando…" em texto | padrão misto, aceitável |

## Foco, loading, temas

- Foco visível global preservado; diálogos usam `useDialog` (foco preso/devolvido/Esc). Em todos os E2E de acessibilidade o foco volta ao ponto de origem.
- Tema escuro e claro: axe (contraste) **0 violações** nas telas auditadas — **depois** das correções desta fase (ver abaixo).

## Inconsistências comprovadas e corrigidas nesta fase

| # | Achado (axe/leitura) | Correção | Efeito global? |
|---|---|---|---|
| 1 | `Button.danger` 4,07:1 no tema claro | `color-mix` com `--badge-mix` | sim, **positivo** (todas as telas) |
| 2 | Selo "Padrão" com cores fixas | tokens do tema | local |
| 3 | Chips de etapa/origem (cor de dados) < 4,5:1 | texto do tema + ponto/ícone colorido | local (Configurações) |
| 4 | `<code>` dos placeholders de template 4,33:1 (escuro) | `--text-dim` | Configurações e Prospecção (template compartilhado) |
| 5 | Fontes em `px` (11–11,5) fora dos tokens | tokens | local |
| 6 | Menu lateral com **dois** itens ativos em `/configuracoes/integracoes` | `activeNavTarget` (caminho mais específico) | sim, **positivo**, `aria-current` único |

## Pendências de Design System

- **P3** unificar os três estilos de formulário (rótulo + erro inline) — fora do escopo desta fase.
- **P3** áreas **não** auditadas por contraste: Agenda, Tarefas, Relatórios, Equipe, Dashboard, SDR/Prospecção, Plataforma (apareceram nos prints de apresentação sem defeito visível, mas **sem axe**).
- **P3** `ProspectImportModal` (staff) mantém o modal estreito antigo.
