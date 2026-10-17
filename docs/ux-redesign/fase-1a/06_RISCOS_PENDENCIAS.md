# 06 — Riscos e pendências (Fase 1A)

## Riscos de regressão ainda existentes (nenhum coberto por teste automatizado)

| # | Risco | Origem | Probabilidade | Como verificar |
|---|---|---|---|---|
| R1 | **Arrastar o cartão** pode se comportar diferente no navegador real (o cartão agora tem um filho `role="button"`; testes usam eventos sintéticos) | PIP-01 | baixa–média (Firefox/toque) | arrastar e soltar entre colunas em Chrome, Firefox e Safari; toque em tablet |
| R2 | **Aparência do cartão**: cursor do resumo é "pointer"; áreas clicáveis mudaram (clicar no espaço do seletor/botões não abre mais o lead — antes `stopPropagation` já impedia) | PIP-01 | baixa | inspeção visual |
| R3 | **Largura do diálogo de importação** 560 px (antes 640 px): linhas de de/para mais apertadas; sem animação própria idêntica | IMP-01 | média | importar uma planilha com 10+ colunas em desktop e celular |
| R4 | **Cores**: `--faint` e o verde do texto no tema claro mudaram globalmente (5 e 20 usos); pode haver ajustes de contraste/hierarquia indesejados | A-05, SYS-02 | média (visual) | percorrer Pipeline, Painel, Tarefas, Agenda, Perfil, Login, Prospecção nos dois temas |
| R5 | `--faint` claro ficou no mesmo nível de `--muted-2` (hierarquia achatada no tema claro) | A-05 | certa (efeito aceito) | decisão de design na Fase 2 |
| R6 | Fechamento do diálogo de importação **depende do evento `input`** do navegador ao escolher o arquivo (para ativar a proteção de dados); o teste simula | IMP-01 | baixa | escolher arquivo e apertar Esc/clicar fora |
| R7 | A confirmação de exclusão de template cita a mensagem (até 80 caracteres) — mensagens muito longas ou com muitas quebras podem deixar o diálogo alto | CFG-02 | baixa | template longo |
| R8 | `ProspectImportModal` (Prospecção) **não** foi migrado e mantém o overlay antigo (mesmo defeito IMP-01 na área interna) | escopo | certa | tratar na fase seguinte |

## Pendências (não implementadas)

| Item | Motivo / destino |
|---|---|
| PIP-04 reordenar colunas por teclado | `it.fails` permanece; Fase 2 (cabeçalho de coluna) |
| PIP-05 seletor "mover" oculto no desktop com mouse; PIP-12 alvos pequenos | fora do escopo; Fase 2 |
| Rótulos dos campos da **Prospecção** (estágios, mensagens, IA) | área interna da GSM; fora do escopo |
| Foco/alinhamento visual do novo resumo do cartão | MANUAL |
| `docs/ux-redesign/fase-0-testes/08_RELATORIO_EXECUCAO.md` ainda diz "não commitado" | os commits agora existem (`f4198860…`, `1f965ea4…`); atualizar o texto na próxima edição da documentação da Fase 0 |
| Documentos da Auditoria 01 e `docs-mapa-de-telas.md` | continuam **não rastreados**; decidir se entram no repositório |
| Backend não foi reexecutado na 1A | nenhuma alteração; a suíte completa (2654 verdes) é do gate da Fase 0 |

## Decisões de implementação que merecem revisão

1. **`aria-labelledby` + `useId`** no painel (em vez de `<label>`): evita mexer no layout; `htmlFor` exigiria trocar `div` por `label` nos blocos de valor.
2. **Usar `Modal`** na importação (em vez de remendar o overlay): corrige tudo de uma vez, ao custo de largura/estilo (R3).
3. **`--accent-text`** em vez de escurecer `--accent`: preserva botões e bordas; custa tocar 13 arquivos CSS (troca mecânica de uma linha cada).
4. A explicação do botão desabilitado usa `role="status"` (educada), não `alert`, para não duplicar com o erro de envio.
5. O texto da confirmação de excluir etapa é **genérico** ("os templates cadastrados para esta etapa") porque a tela não conhece a contagem; mostrar a quantidade exigiria buscar os templates (fora do escopo).
