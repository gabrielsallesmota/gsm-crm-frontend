# 04 — Acessibilidade (Fase 1A)

## O que passou a ser garantido por teste automatizado

| Critério (WCAG 2.2) | Correção | Teste |
|---|---|---|
| 4.1.2 Nome, função, valor — sem interativo aninhado em `button` | PIP-01 | `[CORRIGIDO 1A PIP-01]` (0 interativos dentro do botão; irmãos presentes) |
| 1.3.1 / 3.3.2 / 4.1.2 — campos com nome | DRW-01, N-01, N-02, IMP-06, CFG-06, CFG-07 | testes `[CORRIGIDO 1A …]` e verificações por `getByLabelText` |
| 4.1.2 / 2.4.3 — diálogo modal com nome, foco preso e devolvido | IMP-01 | papel/`aria-modal`/nome; foco volta ao abridor; Esc |
| 2.1.2 — sem armadilha; 3.3.4 — prevenção de perda | IMP-01 | Esc/fundo fecham antes de escolher arquivo, **não** depois; nada fecha durante o envio |
| 4.1.3 Mensagens de status | A-10, N-03 | `role="alert"` (uma região) para erro; `role="status"` para a explicação |
| 3.3.4 Prevenção de erros (exclusão) | CFG-02, CFG-03 | confirmação; cancelar não chama API; Esc devolve o foco ao botão |
| 1.4.3 Contraste (mínimo) | A-05, SYS-02 | razões calculadas dos tokens reais, 3 fundos × 2 temas |

## Contrastes antes → depois (calculados dos tokens de `theme.css`)

Fundos: `bg` / `card-bg` / `card-bg-alt`. Meta: ≥ 4,5:1 (texto normal).

| Combinação | Antes (bg / card / card-alt) | Depois (bg / card / card-alt) |
|---|---|---|
| `--faint` **escuro** (`#5f6b76 → #78848f`) | 3,55 / 3,31 / 3,46 ✗ | **5,07 / 4,73 / 4,93** ✔ |
| `--faint` **claro** (`#8d98a3 → #66717c`) | 2,68 / 2,94 / 2,73 ✗ | **4,55 / 4,98 / 4,64** ✔ |
| Verde como **texto**, claro (`--accent #12a550 → --accent-text #0b7a38`) | 2,94 / 3,22 / 3,00 ✗ | **4,98 / 5,45 / 5,07** ✔ |
| Verde como texto, escuro (`#2ee66e`, sem mudança) | 11,67 / 10,89 / 11,36 | idem (identidade preservada) |
| Âmbar do novo aviso do import (`--tone-amber`), claro | — | 4,57 / 5,01 / 4,66 ✔ |
| Âmbar do novo aviso, escuro | — | 10,36 / 9,67 / 10,08 ✔ |

Hierarquia: no escuro, `--faint` (`#78848f`) continua abaixo de `--muted-2` (`#7f8b96`); no claro, fica no mesmo nível de `--muted-2` (`#636e7a`) — a diferença de peso entre os dois passa a ser pequena (efeito colateral aceito para atingir 4,5:1).
O fundo/borda verdes (`--accent`) **não** mudaram (botões primários, bordas de foco e selos continuam iguais); só o **texto** em verde no tema claro ficou mais escuro. Elementos `.theme-dark` (menu lateral, login) continuam com o verde neon.

## O que **não** foi validado (MANUAL)

1. **Leitor de tela** (NVDA/VoiceOver): anúncio do cartão (agora só o resumo é "botão"), do diálogo de importação, das mensagens `status`/`alert` e das confirmações.
2. **Foco visível** no novo resumo do cartão e nos campos rotulados (usa o `:focus-visible` global; o jsdom não avalia CSS).
3. **Alvos de toque** dos botões WhatsApp/E-mail (≈ 22 px < 24 px; **não** corrigido — fora do escopo da 1A).
4. **Zoom 200 %/400 %** com o diálogo de importação (agora 560 px) e a tabela de de/para.
5. **Arrastar** o cartão com mouse (Chrome, Firefox) e toque; alternância de tema com os novos tokens; aparência real do texto em verde no tema claro.
6. Contraste de **selos** (texto/fundo translúcido) — não tocado.

## Pendentes de acessibilidade (não corrigidos de propósito)

| ID | Situação |
|---|---|
| PIP-04 | reordenar colunas ainda só por arrastar no quadro (`it.fails` permanece) |
| PIP-05 | seletor "mover" oculto no desktop com mouse (`@media`) — MANUAL |
| PIP-12 | alvos pequenos dos botões do cartão |
| Prospecção (área interna) | campos de estágio/mensagem sem rótulo não foram revisados |
| `Modal`: foco inicial | vai para o **primeiro campo**; na importação é o seletor de arquivo (adequado), mas não foi avaliado com leitor de tela |
