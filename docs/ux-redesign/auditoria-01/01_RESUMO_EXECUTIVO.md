# 01 — Resumo executivo

Auditoria técnica e UX/UI do GSM CRM (Pipeline, painel do lead, importação CSV e Configurações).
Data: 2026-10-17. Escopo: somente análise — nenhum código, migration, dependência, branch ou commit foi alterado.

## Método e limites das evidências

- **Inspeção estática** do código dos dois repositórios (`gsm-crm-frontend`, `gsm-crm-backend`), com arquivo e linha.
- **Execução parcial**: o app foi aberto apenas em **modo demonstração** (dados fictícios) para 4 capturas (Pipeline, Configurações, importação, lead aberto). Nada foi validado no ambiente real com dados reais nem com leitor de tela, zoom, celular físico ou usuários.
- **Cálculos**: razões de contraste foram calculadas a partir dos tokens de `src/styles/theme.css`.
- Legenda usada em todos os documentos:
  **[C]** confirmado no código · **[P]** provável (depende de execução) · **[H]** hipótese de UX · **[O]** oportunidade · **[V]** validar com usuário · **[D]** decisão de produto.

## Diagnóstico

O CRM tem uma base sólida: modal acessível reutilizável (`Modal` + `useDialog` com pilha de diálogos, foco preso e proteção de dados digitados), movimento otimista com rollback e bloqueio de corrida no quadro, paginação por coluna, alternativa ao arrastar, estados vazios com orientação, permissões coerentes e isolamento por tenant no backend. **Não há problema P0 confirmado** no escopo.

Os problemas concentram-se em quatro eixos:

1. **O quadro mostra pouco do que o vendedor precisa para decidir** — o card exibe nome, valor, origem, dono e último comentário; não exibe próxima ação, atraso nem tempo parado, embora o backend já devolva a próxima etapa da cadência (`next_cadence_step`) e os demais dados sejam deriváveis (PIP-03).
2. **A importação CSV é o fluxo mais frágil**: modal fora do padrão acessível, lotes acima de 2.000 linhas falham inteiros, dados são descartados silenciosamente e não há pré-visualização (IMP-01 a IMP-04).
3. **Configurações é uma página única de 785 linhas** que mistura áreas do cliente e áreas internas da GSM, com exclusões sem confirmação e efeitos colaterais não informados (CFG-01 a CFG-03).
4. **Acessibilidade de formulários e cards**: campos sem rótulo programático, controles interativos dentro de `role="button"`, alvos pequenos e um token de texto (`--faint`) abaixo de 4,5:1 (PIP-01, DRW-01, IMP-06, CFG-06, PIP-12, PIP-15).

## Números

| Item | Quantidade |
|---|---|
| Achados | 53 (P0: 0 · P1: 11 · P2: 32 · P3: 10) |
| Telas/rotas no escopo | 9 rotas diretas (ver 02) |
| Endpoints relacionados | 44 no escopo central + 14 de origens/cadências (ver 07) |
| Dependências de backend | 6 itens; 3 deles opcionais (ver 07 e 10) |

## Recomendações principais

1. Corrigir antes de qualquer redesign visual os itens de **integridade e acessibilidade de baixo risco**: lotes de importação (chunking/limite), rótulos de campos, confirmação de exclusões, `Modal` compartilhado na importação.
2. Evoluir o **card do Pipeline** com sinais de atenção usando dados que já existem (`next_cadence_step`) e, numa segunda fase, campos agregados novos no backend (próxima atividade, atrasos, tempo na etapa).
3. Reorganizar o **painel do lead** com um cabeçalho de contexto + ação de contato, mantendo uma única coluna rolável (decisão de abas vs. seções em 04).
4. Transformar a importação em um **assistente de 4 passos** reaproveitando `parseCsv`, o mapeamento e `POST /leads/bulk-import` sem novo mecanismo.
5. Dividir Configurações em **sub-rotas por assunto** (Pipelines e etapas, Tags e origens, Mensagens, Automações, Notificações, Integrações), reaproveitando as rotas que já existem.
6. Escrever **testes de componente** para Pipeline, painel do lead, importação e Configurações antes de mexer neles (hoje só há testes de utilitários).

## Riscos de regressão mais relevantes

Mover para etapa "Ganho" no tenant interno da GSM cria um Cliente automaticamente; mover/ganhar/perder dispara eventos de webhook e entradas na timeline; vendedor só acessa os próprios leads; importação respeita dono e deduplicação por telefone. Tudo isso é comportamento de backend que o redesign **não** deve alterar (ver 09).

## Decisões pendentes

Resumidas em `11_DECISOES_PENDENTES.md` (13 decisões). A mais urgente: o que conta como "última interação" e se perder um lead deve exigir motivo.

## Índice

02 Inventário · 03 Pipeline · 04 Painel do lead · 05 Importação CSV · 06 Configurações · 07 Backend · 08 Acessibilidade e responsividade · 09 Matriz de preservação · 10 Backlog · 11 Decisões · 12 Plano.
