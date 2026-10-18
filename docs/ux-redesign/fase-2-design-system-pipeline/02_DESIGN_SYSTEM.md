# 02 — Design System

## Auditoria do que já existia

`src/styles/theme.css` já era a fonte única de **cor** (tema escuro = `:root`, claro = `:root[data-theme="light"]`, `.theme-dark` fixa o menu lateral), com os tokens `--bg`, `--card-bg(-alt)`, `--border(-strong)`, `--text(-dim)`, `--muted(-2)`, `--faint`, `--accent*`, `--danger*`, `--tone-*` (pares texto/fundo), `--hover-bg*`, `--radius-card/input/pill`, `--shadow-pop`, `--focus`. **Não existiam** tokens de espaçamento, tipografia, camadas (z-index), movimento, elevação de cartão nem estados de interação do quadro — o Pipeline usava px soltos (`12px`, `11.5px`, `14px`…). Componentes comuns existentes e **reaproveitados sem reescrever**: `Button`, `Badge`, `Avatar`, `HelpTip`, `EmptyState`, `Skeleton*`, `PeriodFilter`, `Modal`, `ConfirmDialog`.

**Decisão:** nenhuma biblioteca nova, nenhuma segunda folha de estilos. Tudo continua em CSS Modules + `theme.css`; só foram **adicionados** tokens (não houve renomeação nem remoção) e 3 primitivos novos em `components/common/`.

## Tokens acrescentados (`theme.css`)

| Grupo | Tokens | Observação |
|---|---|---|
| Espaçamento (base 4 px) | `--space-1…8` = 4, 8, 12, 16, 20, 24, 32 | independente de tema |
| Tipografia | `--fs-xs…2xl` = 12, 13, 14, 16, 20, 24 px; `--lh-tight` 1,25; `--lh-normal` 1,45 | **piso de 12 px** (PIP-16: antes havia 11 e 11,5 px) |
| Raios | `--radius-sm` 8, `--radius-md` 12 | + os existentes `card` 15 / `input` 11 / `pill` |
| Camadas | `--z-base` 1, `--z-sticky` 10, `--z-dropdown` 30, `--z-overlay` 100, `--z-toast` 200 | só o Pipeline passou a usar; o resto do app não foi renumerado |
| Movimento | `--ease`, `--dur-fast` 120 ms, `--dur` 180 ms | todas as transições novas respeitam `prefers-reduced-motion` |
| Superfícies/elevação | `--column-bg`, `--shadow-card`, `--shadow-lift` | claro e escuro redefinidos |
| Estados do quadro | `--drop-bg`, `--drop-border`, `--selected-bg` | destino do arraste e aba selecionada |
| WhatsApp | `--tone-wa-text` | claro `#0a6b36` (≈ 6:1), escuro `#25d366` (≈ 7:1) — **corrige o contraste documentado** |

### Breakpoints

`@media` não aceita variáveis CSS; os cortes ficam **documentados e espelhados em `hooks/useMediaQuery.ts` (`BREAKPOINTS`)**: `mobileMax = 760` (celular: uma etapa por vez), `compactMax = 900` (cabeçalho empilha; é o corte já usado pelo menu lateral). Pointer: `(pointer: coarse)` para toque (alvos de 44 px) e `(hover: hover) and (pointer: fine)` para mouse.

## Hierarquia visual aplicada

1. **Fundo neutro** (`--bg`) → **coluna** (`--column-bg`, um degrau mais escura/clara) → **cartão** (`--card-bg` + `--shadow-card`): três níveis de superfície claramente separados nos dois temas.
2. **Texto**: nome do lead em `--heading` 14 px/650 (principal); empresa/comentário em `--muted` 12 px (secundário); origem e idade 12 px (terciário). Contraste ≥ 4,5:1 (axe: 0 violações de `color-contrast`).
3. **Ação primária única** por tela: "Novo lead" (verde de acento); Importar/Exportar são secundárias (contorno); filtros ativos em chips (texto + ✕, nunca só cor).
4. **Marca preservada**: verde `--accent`, tipografia (Sora/Space Grotesk) e o menu lateral escuro permanecem.

## Componentes do Design System

| Componente | Local | Função |
|---|---|---|
| `Icons` | `common/Icons.tsx` | 11 ícones SVG inline (`currentColor`, `aria-hidden`); o nome acessível fica sempre no botão/link — substitui emojis soltos (💬 ✉) nos cartões |
| `FilterChip` | `common/FilterChip.tsx` | chip "grupo: valor" com botão de remover nomeado ("Remover filtro Responsável: Ana") |
| `useMediaQuery` / `useIsMobile` | `hooks/useMediaQuery.ts` | `matchMedia` reativo; sem `matchMedia` (jsdom) = layout de desktop |

Reaproveitados e **ajustados**: `PeriodFilter` (campos de data com `min-width: 0`, quebram linha — corrige o overflow do WebKit), `WhatsappButton`/`EmailButton` (variante `size="icon"`, alvo 28 px / 44 px em toque; WhatsApp com o novo token de texto), `AppLayout.module.css` (menu lateral fechado deixa de vazar sombra e sai da ordem de Tab).

Componentes específicos do Pipeline (`components/pipeline/`) estão em `04_COMPONENTES_ALTERADOS.md`.

## Regras para as próximas fases (Prompts 07 e 08)

- Usar **somente** tokens (`var(--space-*)`, `var(--fs-*)`, `var(--radius-*)`); valor "mágico" novo = adicionar token antes.
- Interativo = nome acessível + foco visível + alvo ≥ 24 px (44 px em `pointer: coarse`).
- Estado nunca só por cor: texto, ícone ou borda junto.
- Movimento só com `prefers-reduced-motion` respeitado.
- Seletores de teste: `data-*` e papéis acessíveis; evitar `class*=` (os nomes de CSS Module mudam).
