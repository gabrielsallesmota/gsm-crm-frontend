# 11 — Evidências visuais (capturas REAIS)

Geradas por `e2e/visual-evidence-lead-import.spec.ts` a partir do **app em execução** contra a API isolada (`gsm_crm_e2e`), com dados **fictícios** (nomes e empresas inventados; domínios `example.com`). **Não são mockups.** Pasta: `docs/ux-redesign/fase-3-lead-import/evidencias/`.

| # pedido | Evidência | Arquivo |
|---|---|---|
| 1 | Painel desktop · claro (1366×768) | `drawer-desktop-claro.png` |
| 2 | Painel desktop · escuro | `drawer-desktop-escuro.png` |
| 3 | Painel mobile (390×844) | `drawer-mobile.png` |
| 4 | Painel em edição (grupos de campos, rodapé fixo) | `drawer-edicao.png` |
| 4b | Edição no celular com erro de validação | `drawer-mobile-edicao-validacao.png` |
| 5 | Timeline / atividades (comentário em foco) | `drawer-timeline.png` |
| 6 | CSV — etapa 1, seleção do arquivo | `csv-1-arquivo.png` |
| 7 | CSV — etapa 2, mapeamento (campo "obrigatório", colunas ignoradas) | `csv-2-colunas.png` |
| 8 | CSV — etapa 3, revisão (opções, números, resumo do mapeamento) | `csv-3-revisao.png` |
| 9 | CSV — etapa 4, progresso (lote 1 de 1 em voo: 0 de 7 linhas, 0%) | `csv-4-progresso.png` |
| 10 | CSV — etapa 5, resultado (criados, duplicado ignorado, falha de validação, orientações) | `csv-5-resultado.png` |
| 11 | CSV no celular (colunas e revisão, tela cheia) | `csv-mobile-colunas.png`, `csv-mobile-revisao.png` |

## Leitura rápida

- **Painel:** cabeçalho com avatar, nome, empresa, selo de etapa e responsável; ações rápidas (WhatsApp · Ligar · E-mail · Editar); Resumo comercial em cartões; Contato sempre à vista; "Dados complementares" recolhido.
- **Edição:** quatro grupos com legendas, `*` no Nome, mensagem de erro vermelha junto do campo, rodapé fixo "Alterações não salvas · Cancelar · Salvar alterações".
- **CSV:** indicador de 5 etapas com ✓ nas concluídas; tabela *coluna · exemplo · campo*; no resultado, números grandes (verde = criados, vermelho = falhas) e a seção "O que fazer agora" só com os problemas que de fato ocorreram.

## Limitações

Capturas do Chromium (referência). Hover/foco são estados estáticos. Dados do resultado vêm de uma planilha fictícia de 8 linhas (7 passam na validação do navegador; o servidor aceita 6 e ignora 1 duplicada; 1 linha sem nome é recusada), não de um volume real. A captura de progresso fotografa o instante **em que o lote já foi enviado mas a resposta ainda não chegou** (o teste segura a resposta de propósito): por isso mostra 0 de 7 linhas (0%) — o progresso só avança quando o servidor confirma. Os números reais de progresso intermediário (ex.: 500 de 600) são verificados nos testes funcionais, não nesta imagem.
