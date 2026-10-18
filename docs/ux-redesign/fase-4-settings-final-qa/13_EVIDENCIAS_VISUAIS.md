# 13 — Evidências visuais (capturas REAIS desta fase)

Geradas por `e2e/visual-evidence-phase4.spec.ts` a partir do **app em execução** (build de produção do front + API real isolada), com dados **fictícios** (nomes e empresas inventados, domínios `example.com`). **Não são mockups nem capturas antigas reaproveitadas.** As capturas só são tiradas depois que as animações de entrada terminam. Pasta: `docs/ux-redesign/fase-4-settings-final-qa/evidencias/`.

| # pedido | Evidência | Arquivo |
|---|---|---|
| 1 | Pipeline desktop · claro (1440×900) | `01-pipeline-desktop-claro.png` |
| 2 | Pipeline desktop · escuro | `01-pipeline-desktop-escuro.png` |
| 3 | Pipeline mobile (390×844) | `03-pipeline-mobile.png` |
| 4 | Painel do lead · desktop | `04-drawer-desktop.png` |
| 5 | Painel do lead · mobile | `05-drawer-mobile.png` |
| 6 | CSV — seleção | `06-csv-selecao.png` |
| 7 | CSV — mapeamento | `07-csv-mapeamento.png` |
| 8 | CSV — revisão | `08-csv-revisao.png` |
| 9 | CSV — progresso (lote em voo; 0 de 7 linhas) | `09-csv-progresso.png` |
| 10 | CSV — resultado (criados, duplicado ignorado, falha de validação) | `10-csv-resultado.png` |
| 11 | Configurações — visão geral | `11-config-visao-geral.png` |
| 12 | Configurações — pipelines | `12-config-pipelines.png` |
| 13 | Configurações — etapas (formulário de edição aberto) | `13-config-etapas.png` |
| 14 | Configurações — tags | `14-config-tags.png` |
| 15 | Configurações — templates (Comunicação) | `15-config-templates.png` |
| 16 | Configurações — mobile (seletor de seção + atalhos) | `16-config-mobile.png` |
| 17 | **Confirmação de lead perdido** | `17-confirmacao-lead-perdido.png` |

## Leitura rápida

- **Configurações:** navegação lateral por categoria (Funil de vendas · Comunicação · Automação · Equipe e acesso · Integrações), cartões com título e explicação, chips de etapa com ponto colorido, "Padrão" em verde, origens somente leitura.
- **Etapa em edição:** nome, cor, Ganho/Perdido, Salvar/Cancelar, setas e Excluir, mais o aviso "Ganho e Perdido são exclusivos. Mover um lead para uma etapa Perdido pede confirmação."
- **Confirmação de perdido:** texto cita lead e etapa; botão "Marcar como perdido" com contraste corrigido.

## Limitações

Referência do **Chromium**, claro (escuro só no Pipeline, #2). Dados do resultado do CSV vêm de uma planilha de 8 linhas, não de volume real. A captura de progresso mostra o instante em que o lote foi enviado e a resposta ainda não chegou (retida de propósito pelo teste): por isso 0 %.
