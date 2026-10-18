# 09 — Evidências visuais (capturas REAIS)

Geradas pelo Playwright (`e2e/visual-evidence.spec.ts`) a partir do **app em execução** contra a API real do ambiente isolado, com dados **fictícios** (sem dado pessoal). **Não são mockups.** Caminho: `docs/ux-redesign/fase-2-design-system-pipeline/evidencias/`. As capturas documentam o estado; o comportamento é garantido pelos testes de `08`.

| Evidência | Arquivo |
|---|---|
| Pipeline desktop 1920 · claro | `evidencias/pipeline-desktop-1920-claro.png` |
| Pipeline desktop 1920 · escuro | `evidencias/pipeline-desktop-1920-escuro.png` |
| Pipeline notebook 1366 · claro / escuro | `evidencias/pipeline-notebook-1366-claro.png`, `…-escuro.png` |
| Pipeline tablet 768 · claro / escuro | `evidencias/pipeline-tablet-768-claro.png`, `…-escuro.png` |
| Pipeline mobile 390 · claro / escuro | `evidencias/pipeline-mobile-390-claro.png`, `…-escuro.png` |
| **Card em hover** | `evidencias/card-hover.png` |
| **Card em foco** (teclado: borda de acento + seletor "mover" revelado) | `evidencias/card-foco-teclado.png` |
| **Card arrastando + coluna "Soltar aqui"** | `evidencias/arrastando-card.png` |
| **Coluna vazia** (e quadro com um lead) | `evidencias/colunas-vazias.png` |
| **Estado de carregamento** (esqueletos) | `evidencias/carregando-esqueletos.png` |
| Coluna com erro e "Tentar de novo" | `evidencias/coluna-com-erro.png` |
| Filtros abertos + chips ativos | `evidencias/filtros-abertos-com-chips.png` |

Também geradas pela suíte de acessibilidade (4 resoluções × 2 temas × Pipeline e 3 estados da importação): `e2e/.artifacts/screenshots/` (não versionadas; 40 imagens) e os 32 relatórios do axe em `e2e/.artifacts/axe-*.json` (**0 violações**).

## Leitura rápida do que as imagens mostram

- **Hierarquia**: coluna cinza-azulada (`--column-bg`) → cartão branco com sombra leve; nome em destaque, empresa/comentário discretos, valor em verde à direita.
- **Cartão**: origem + idade ("hoje"/"3 d") numa linha; rodapé com avatar do responsável e ícones de WhatsApp/e-mail; sem botões de texto.
- **Cabeçalho**: título + nome do pipeline + "?" · resumo "24 oportunidades · 19 em andamento (R$ 58.800)" · "Novo lead" (primário) + Importar/Exportar.
- **Mobile**: abas de etapa com contagem; uma coluna por vez; ações numa linha; seletor "mover" sempre visível.
- **Escuro**: mesmos níveis de superfície, contraste mantido (WhatsApp ≈ 7:1).

## Limitações

Capturas de Chromium (referência visual). Firefox/WebKit foram verificados **funcionalmente** (layout sem overflow, Tab, arraste), não comparados pixel a pixel. Hover/foco são capturas de um estado estático.
