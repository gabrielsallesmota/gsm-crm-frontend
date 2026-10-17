# 01 — Resumo executivo — Fase 0 (rede de segurança)

## O que foi feito

Criada uma rede de testes de **caracterização** sobre Pipeline, painel do lead, importação CSV, Configurações, permissões/isolamento e componentes compartilhados, **sem alterar código de produção**. Os testes descrevem o que o sistema faz **hoje** (inclusive suas limitações) para que as próximas fases detectem regressões e saibam exatamente qual teste mudar de propósito.

| | Frontend | Backend | Total |
|---|---|---|---|
| Testes novos **executados** | 262 | 43 | **305** |
| Testes **planejados** (não verdes) | 26 `todo` | 14 `skip` | 40 |
| Arquivos de teste criados / modificados | 10 / 0 | 2 / 0 | 12 / 0 |
| Dependências alteradas | 0 | 0 | 0 |
| Código de produção alterado | 0 | 0 | **0** |

## Resultados

- **Frontend**: lint limpo · tipos limpos · 239 testes Node + 350 Vitest passam (0 falhas; 14 *expected fail* e 26 *todo* por desenho) · build OK.
- **Backend**: black/ruff/mypy limpos · **2654 passam, 14 pulados (planejados), 0 falhas** (eram 2611).
- Nenhuma falha pré-existente.

## Cobertura funcional (F-01 a F-38)

**29 COBERTAS · 9 PARCIAIS · 0 NÃO COBERTAS.** Os PARCIAIS são F-03 (seletor de etapa — CSS responsivo é manual), F-11 (download), F-16 (tags), F-29/F-30/F-31 (conteúdo das telas de Automações, Notificações, Integrações e área interna têm suítes próprias), F-34 (repositórios demo), F-35 (checklist de onboarding) e F-36 (alternância de tema). Detalhe com referência a cada teste em `02_MATRIZ_COBERTURA.md`.

## Principais achados (não corrigidos)

1. **14 falhas de acessibilidade/UX guardadas** como `it.fails` (11 conhecidas + **3 novas**: campos de data do filtro de período e seletor de arquivo da importação sem nome acessível; "Importar" desabilitado sem explicar a falta da coluna Nome).
2. **Errata da Auditoria 01**: em "atualizar", telefone e WhatsApp **são** gravados (a auditoria dizia que não); o que não é atualizado é origem, classificação, fonte, site e documento.
3. **Importação**: o teto de 2.000 linhas derruba o lote inteiro e a tela não avisa (confirmado de ponta a ponta: 2.001 e 10.000 linhas).
4. **D-01**: o campo "última interação" só muda ao **mover** o lead — comentário, tarefa concluída, edição e import-update não o alteram; a regra aprovada é diferente. Documentado e testado como estado atual.
5. A sessão de suporte somente leitura **não esconde** botões de escrita (a recusa vem do servidor); isto é melhoria de UX, não de segurança.

## Riscos que ainda existem

CSS/layout/responsividade e arrastar real não são testados (jsdom); importação com milhares de linhas não foi medida no navegador; corrida entre importações simultâneas não foi testada; telas de Automações/Notificações/Integrações/SDR não ganharam testes novos. Ver `06` e `09`.

## Pode avançar?

**Sim, para os itens da Fase 1** listados em `09_HANDOFF_FASE_1.md` (integridade da importação, rótulos, confirmações, contraste, ordenação no servidor), **após** a revisão e o commit autorizados deste diff. Para as fases visuais (2 em diante), recomenda-se acrescentar antes uma camada de verificação visual/e2e em navegador real (requer aprovar uma dependência de desenvolvimento).

## Índice

02 Matriz de cobertura · 03 Testes de frontend · 04 Testes de backend · 05 Permissões e multi-tenant · 06 Falhas conhecidas · 07 Testes futuros · 08 Relatório de execução · 09 Handoff para a Fase 1.
