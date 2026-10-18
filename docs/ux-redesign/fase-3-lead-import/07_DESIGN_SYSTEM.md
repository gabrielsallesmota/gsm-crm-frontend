# 07 — Design System (reuso do Prompt 06)

Nenhuma segunda identidade visual. Todo CSS novo usa **apenas** tokens de `styles/theme.css` (espaçamento `--space-*`, tipografia `--fs-*`/`--lh-*`, raios `--radius-*`, cores semânticas `--tone-*`/`--accent*`/`--danger*`, `--z-*`). **Nenhum token novo** foi criado; nenhum valor de cor em hexadecimal foi escrito nos módulos.

## Reaproveitado

| Recurso | Uso nesta fase |
|---|---|
| `Avatar`, `Badge`, `Button`, `ConfirmDialog`, `Modal`, `CurrencyInput` | cabeçalho, ações, confirmações (descartar, perdido, interromper), campos |
| Padrão *disclosure* (`aria-expanded` + `aria-controls` + `hidden`) | "Dados complementares" |
| Padrão de estados (esqueleto, vazio, erro com retry) | tarefas, timeline |
| Famílias `--tone-*` | cores dos tipos de evento da timeline |

## Padronizado

| Elemento | Regra |
|---|---|
| Título de seção | 12 px, caixa alta, `--muted` (`.sectionTitle`) |
| Campo de leitura | cartão `--card-bg`, rótulo `--fs-xs`, valor `--fs-md` 600 |
| Campo de entrada | altura mínima 38 px, borda `--border-strong`, inválido com `--danger` + mensagem |
| Botão-link ("Ver mais", "+ Nova tarefa") | texto `--accent-text`, área ≥ 32 px |
| Alvos de toque | fechar 40×40; check de tarefa 32×32; ações rápidas 36 px; tags 32 px |
| Alertas/avisos | `--tone-amber` (aviso), `--tone-red` / `--danger-*` (erro), `--accent-bg` (próxima ação) |
| Estado vazio | texto `--muted-2` curto e acionável |
| Piso tipográfico | 12 px (o do Prompt 06) |

## Compartilhados — impacto avaliado

- `Modal`: ganhou a propriedade opcional `size="wide"`. O comportamento padrão (560 px) não mudou; só o assistente de CSV usa `wide`. Os demais modais seguem idênticos (testes de UI e E2E existentes verdes).
- `LeadImportModal` deixou de importar o CSS de `ProspectImportModal.module.css` (o módulo de Prospecção continua intacto e sem mudança).
- `LeadDrawer.module.css` foi reescrito (era exclusivo do drawer; nenhum outro componente o importa).

## Temas

Claro e escuro verificados com axe (contraste incluído, regra fixa) em 4 resoluções — ver `08`. As cores semânticas da timeline usam os pares `--tone-*` e `--tone-*-bg`, que já têm variantes nos dois temas.
