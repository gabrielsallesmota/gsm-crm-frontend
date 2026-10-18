# 06 — Acessibilidade (WCAG 2.2 AA)

## O que foi garantido (com teste)

| Critério | Como ficou |
|---|---|
| 1.4.3 Contraste | **botão de WhatsApp corrigido** (`--tone-wa-text`: ≈ 3,9 → ≈ 6:1 no claro). `color-contrast` agora é regra **fixa** do axe no Pipeline e no diálogo de importação (4 resoluções × 2 temas): **0 violações** |
| 1.4.1 Uso de cor | nenhum estado só por cor: "Sem responsável" (texto + borda), "Soltar aqui" (texto), "Movendo…" (texto), chips "grupo: valor" + ✕, abas `aria-pressed`, ganho/perda com texto para leitor de tela |
| 2.1.1 / 2.5.7 Teclado e arrastar | mover = arrastar **ou** seletor (aparece com o foco no cartão) **ou** abrir o lead; reordenar etapas por botões (foco preservado após a recarga) |
| 2.4.7 / 2.4.11 Foco visível | contorno de 2 px em todo controle; o **seletor "mover" tinha o contorno zerado pelo `select:focus` global** (achado do E2E no Prompt 05) — corrigido; cartão ganha borda de acento com `:focus-within` |
| 2.5.8 Alvo mínimo | ícones de contato e setas de etapa 28 px (mouse) / **44 px** (toque); chips 28 px / 36 px; testados com `boundingBox` em desktop e em emulação de celular |
| 4.1.2 Nome/papel/valor | cartão = **um** `role="button"` ("Abrir <nome>") com `aria-describedby` para um resumo falado (empresa, valor, responsável, idade); contatos, mover, setas, chips e "Filtros" (`aria-expanded`, `aria-controls`) com nome acessível; grupos nomeados ("Filtros ativos", "Escolher etapa") |
| 1.3.1 / 4.1.2 Sem interativo aninhado | o botão do cartão não contém links/botões/selects (teste); contatos e seletor são **irmãos** |
| 4.1.3 Mensagens de estado | resumo `aria-live="polite"`; "Movendo…" e "Carregando…" em `role="status"`; erro de coluna `role="alert"`; toast de reordenação com a posição |
| 2.3.3 / animações | todas as transições novas desligadas em `prefers-reduced-motion` |
| 2.4.3 Ordem de foco | cabeçalho → filtros → cartões (E2E); **menu lateral fechado no celular saiu da ordem de Tab** (antes, links invisíveis recebiam foco) |
| 1.4.10 Reflow | sem rolagem horizontal da página em 390 px; zoom/viewport estreito tratados pelas abas de etapa |

## Semântica do cartão

```
<div data-lead-id draggable aria-busy>              ← contêiner neutro (arrastável)
  <div role="button" aria-label="Abrir Maria" aria-describedby=resumo>  ← ÚNICO botão do cartão
  <footer>  responsável · <a aria-label="Abrir WhatsApp de Maria"> · <a aria-label="Escrever e-mail para Maria">
  <select aria-label="Mover Maria para outra etapa">  ← irmão; visualmente oculto até o foco (mouse) / sempre visível (toque)
```

## Verificado vs. não verificado

- **Verificado automaticamente**: axe-core (WCAG 2.0/2.1/2.2 A/AA) nas telas do Pipeline e da importação; navegação por teclado ponta a ponta; alvos de toque; foco visível; ausência de aninhamento interativo; reflow.
- **NÃO verificado — leitor de tela real (NVDA/VoiceOver)**: indisponível no ambiente; os testes validam atributos e a árvore de acessibilidade, **não** o que é falado. Pendente manual (`10`).
- **NÃO verificado — dispositivos físicos** e zoom de 200 % em navegador real (só viewports estreitos).
