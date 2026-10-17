# 09 — Riscos e pendências

## Riscos residuais

| # | Risco | Mitigação / decisão necessária |
|---|---|---|
| R1 | **Sem índice único em telefone**: duas importações *simultâneas* (abas/usuários diferentes) com o mesmo telefone novo podem criar duplicado (a idempotência cobre reenvio do *mesmo* lote, não corrida entre *importações* distintas). Já existia antes. | Índice único parcial exigiria migration + saneamento: fase própria. |
| R2 | **Relatório só na sessão**: fechar a página perde o relatório detalhado (os dados ficam gravados; reabrir a mesma planilha + retomar reconstrói o relatório pelo replay, dentro de 24 h). | Opção B/C (job no servidor) se for requisito. |
| R3 | Retomada depende da **mesma assinatura** (arquivo, tamanho, linhas, parâmetros, mapeamento). Alterar qualquer um inicia nova importação (correto, mas pode duplicar se o usuário escolher "duplicar"). | Documentado na tela; estratégia padrão é "ignorar". |
| R4 | Chave expira em 24 h: retomar depois disso reenvia lotes já gravados (com "ignorar", viram duplicados ignorados; com "duplicar", duplicam). | Aviso no handoff; considerar TTL maior. |
| R5 | Ordenação: o card movido fica na posição otimista até a próxima recarga; ordenação por valor/probabilidade existe na API, não na tela. | Aceito. |
| R6 | A tela não valida e-mail/telefone (decisão do servidor). Avisamos só telefone curto. | Possível melhoria. |
| R7 | `ProspectImportModal` **não** usa o motor de lotes (endpoint e esquema próprios); só a11y foi tratada. | Escopo da 1B era leads. |
| R8 | `ProspectDrawer` e demais campos da Prospecção interna não foram medidos campo a campo. | Varredura na próxima fase. |
| R9 | Testes de jsdom não provam renderização real (CSS `:has(:focus-visible)`, `<progress>`, tamanho de alvos). | **MANUAL** abaixo. |

## Verificações manuais pendentes (não executadas)

1. Importar CSV real de ~1.000 e 10.000 linhas em **ambiente de homologação** (não produção) e conferir progresso, cancelar, retomar após recarregar, relatório CSV no Excel.
2. Derrubar a rede no meio de um lote e confirmar que o reenvio não duplica.
3. Pipeline com mouse: o seletor "mover" aparece ao tabular até o cartão; botões de etapa com foco visível; toque em celular.
4. Leitor de tela (NVDA/VoiceOver): anúncio do toast de posição e do estado do progresso.
5. Temas claro/escuro: contraste dos botões novos e avisos âmbar.
6. Arrastar card e coluna continuam funcionando.
7. Fase 1A: itens manuais já listados em `fase-1a/06` continuam abertos.

## Dependências de decisão (não iniciadas)

D-01 (indicadores de última interação), D-02/06/07/08/09/11/12/13: nenhuma foi implementada.
