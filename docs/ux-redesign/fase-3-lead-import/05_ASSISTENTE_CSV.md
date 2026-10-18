# 05 — Assistente de importação CSV (5 etapas)

O mecanismo de processamento **não foi reescrito**: `utils/leadImport.ts` (validação, lotes, retentativas, idempotência, janela de retomada, relatório) está intacto. Mudou a apresentação e a navegação.

## Etapas

| # | Etapa | Conteúdo | Ações |
|---|---|---|---|
| 1 | **Arquivo** | seletor de CSV, nome/tamanho após a leitura, limites (10.000 linhas, 5 MB, lotes de 500), exigência de cabeçalho/Nome, erros claros | Cancelar |
| 2 | **Colunas** | "N linha(s) encontrada(s)", tabela *coluna · exemplo · campo do lead*, "obrigatório" na coluna mapeada para Nome, lista do que **não** será importado | Cancelar · Voltar · **Continuar** (bloqueado sem Nome, com explicação) |
| 3 | **Revisão** | estágio de entrada, responsável (admin/gestor), estratégia de duplicados **com explicação do efeito**, números (linhas/válidas/inválidas/lotes), avisos, resumo do mapeamento. "Nada foi enviado ainda." | Cancelar · Voltar · **Importar N lead(s)** |
| 4 | **Importação** | barra `<progress>` com valor real, "Enviando lote X de Y (nova tentativa n)", processadas de N (%), criados/atualizados/ignorados/com erro | **Interromper importação** (com confirmação) |
| 5 | **Resultado** | estado final, totais por categoria, "O que fazer agora" por tipo de problema, lista de linhas (200 primeiras), **Baixar relatório (CSV)** sempre disponível | Fechar · Retomar importação (se falhou/interrompida) · Ver no pipeline |

O indicador de etapas (`ol`, `aria-current="step"`, texto "Concluída/Etapa atual" para leitor de tela) é discreto; no celular só a etapa atual mostra o nome.

## Progresso real, nunca estimado

O percentual exibido é `linhas confirmadas pelo servidor ÷ linhas válidas` — o mesmo `processed` que alimenta a barra. Não há animação falsa nem 100% antes da hora.

## O que mudou de comportamento (e por quê)

- Antes: arquivo → mapeamento + opções + pré-importação numa única tela; agora separados em passos. O botão "Importar" fica na revisão.
- Texto "Cancelar importação" → **"Interromper importação"**, agora com confirmação, porque o que já foi gravado **não** é desfeito (ver `06`).
- Baixar o relatório deixou de depender de existirem linhas problemáticas.
- Rótulos acessíveis dos campos e a lógica de retomada permanecem; os testes foram ajustados para atravessar as etapas (nenhum teste foi removido: 67 → 73).

## Componentes

`components/leads/LeadImportModal.tsx` (estado + execução) e `components/leads/import/`: `ImportStepper`, `StepFile`, `StepColumns`, `StepReview`, `StepProgress`, `StepResult`, `format.ts`, `ImportWizard.module.css`. `Modal` ganhou `size="wide"` (920 px; tela cheia a 100dvh no celular).

## Modal: largura

A Fase 1A apontou o modal mais estreito. O assistente usa 920 px no desktop (tabela de 3 colunas confortável) e **tela cheia** em ≤ 560 px, com barra de ações fixa no rodapé. Outros modais continuam com 560 px.
