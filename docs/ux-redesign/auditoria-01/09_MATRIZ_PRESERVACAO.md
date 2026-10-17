# 09 — Matriz de preservação funcional

Nada desta lista pode ser perdido ou alterado inadvertidamente no redesign. Coluna "Backend?" = o item exige mudança no backend para a alteração UX proposta (não para preservar). Risco: B/M/A.

| # | Funcionalidade | Implementação atual | Alteração UX proposta | Backend? | Risco | Testes necessários |
|---|---|---|---|---|---|---|
| F-01 | Quadro por etapas reais do pipeline | `usePipelineBoard`: 1 consulta por etapa, 25/página, "Carregar mais" | Manter; stale-while-revalidate | Não | M | contador total real; carregar mais; descarte de respostas antigas; troca de filtro |
| F-02 | Mover lead (arrastar) | HTML5 DnD → `move` otimista com rollback | Realce do destino; manter | Não | M | mover ok; falha com rollback; duplo movimento ("busy"); destino igual (noop) |
| F-03 | Mover lead (alternativa) | select no card (toque) e no painel | Menu "Mover para…" acessível | Não | B | mover por teclado e por toque; foco após mover |
| F-04 | Reordenar etapas | arrastar cabeçalho (`pipeline.reorder`); setas em Configurações | Menu de coluna; manter setas | Não | B | só admin/gestor; permutação completa; erro de API |
| F-05 | Seleção de pipeline | `select` se > 1 pipeline | Cabeçalho com nome sempre visível | Não | B | 1 e N pipelines; padrão |
| F-06 | Busca de leads | debounce 300 ms; servidor | Manter; opcional URL | B-4 opcional | B | termo vazio/especial; combinada com filtros |
| F-07 | Filtro por responsável | `leads.viewAll`; "Sem responsável" (`unassigned`) | Manter; mover para filtros | Não | B | vendedor não vê o filtro; "sem responsável" |
| F-08 | Filtro de período | `PeriodFilter` por data de **criação** | Rótulo claro; presets reavaliados | Não | B | presets; custom; virada de dia |
| F-09 | Ordenação do quadro | client-side por coluna | Servidor (`sort_by`) | Não | M | cada critério com coluna > 25 itens |
| F-10 | Importar planilha | `LeadImportModal` → `bulk-import` (≤ 2.000) | Assistente em 4 passos + lotes | Não | A | codificação ANSI/UTF-8; `;`/`,`; duplicados (3 estratégias); dono vendedor; > 2.000 linhas; erros por linha |
| F-11 | Exportar CSV | `GET /leads/export` (neutraliza fórmulas, audita) | Mover p/ menu "Mais" | Não | B | download; vendedor só os próprios; bloqueio em suporte |
| F-12 | Card do lead | nome, empresa, último comentário, valor, origem, dono, WhatsApp, e-mail | Faixa de status; ações ao foco | B-1 (fase 2) | M | exibição sem dados; truncamento; clique abre; foco |
| F-13 | Abrir lead (painel) | estado local; `/leads/:id` na lista | `?lead=` no Pipeline | Não | M | abrir/fechar; voltar do navegador; compartilhar |
| F-14 | Editar dados do lead | "Editar" → "Salvar alterações" | Rótulos; validação inline | Não | M | campos; clamp de probabilidade; erro de API; `hasUnsaved` |
| F-15 | Trocar etapa/responsável no painel | grava na hora; dono só admin/gestor | Manter; rotular "imediato" | Não | B | permissão; usuário inativo; toast |
| F-16 | Tags do lead | seleção em modo edição | Mostrar também fora da edição | Não | B | adicionar/remover; sem tags cadastradas |
| F-17 | Notas | campo livre sobrescrito a cada edição | Manter | Não | B | salvar/limpar |
| F-18 | Tarefas do lead | listar (50), criar (`TaskFormModal`), concluir/reabrir | Atalhos de prazo | Não | B | criar; concluir; atrasada; > 50 |
| F-19 | Comentários e timeline | `POST comments`; `GET timeline` (100) | "Ver mais"; tipos de interação | B-5/B-6 opc. | M | comentário vazio/longo; timeline vazia/erro; itens do sistema |
| F-20 | Excluir lead | `ConfirmDialog`; auditoria; vendedor dono pode | Manter regra | Não | M | confirmação; permissão; remoção do quadro; foco |
| F-21 | WhatsApp do lead | link `wa.me`; **com template** abre com mensagem; **sem template** abre em branco; precedência origem → coringa | Manter | Não | B | com/sem template; sem telefone; placeholders |
| F-22 | E-mail do lead | `mailto:` | Manter | Não | B | com/sem e-mail |
| F-23 | Etapa Ganho/Perdido | flags exclusivas; toasts; alimentam conversão/receita; Ganho no tenant interno cria Cliente | Confirmar/motivo só se D-03 | B-3 cond. | A | efeitos colaterais do backend; webhook; dashboard |
| F-24 | Pipelines | criar (semeia etapas), renomear/cor, padrão, excluir (409 se padrão/único/com leads) | Sub-rota própria | Não | M | cada 409; padrão para intake; sem pipeline |
| F-25 | Etapas | criar, editar, reordenar, excluir (409 com leads; ≥ 1 aberta; apaga templates) | Criar com ganho/perdido; avisar cascata | Não | M | cada regra; cascata de templates |
| F-26 | Tags | criar com cor; excluir | Confirmar exclusão | Não | B | criar; excluir; leads afetados |
| F-27 | Origens | lista estática do enum | Decidir D-04 | Não (já existe) | M | exibição; integrações legadas |
| F-28 | Templates de WhatsApp | etapa × origem; coringa; 409 duplicado; placeholders | Prévia; rótulos; confirmar exclusão | Não | M | precedência; duplicidade; edição não troca etapa; vazio |
| F-29 | Automações e Notificações | rotas e permissões próprias | Entrar no menu de Configurações | Não | B | guardas por papel/feature; links existentes |
| F-30 | Integrações (credenciais e webhooks) | `/configuracoes/integracoes` (admin) | Entrar no menu | Não | B | guarda `integrations.manage` |
| F-31 | Área interna GSM (SDR/Prospecção) | seções extras para staff em Configurações e quadro em Pipeline | Separar e rotular | Não | M | invisível para não staff (404); sessão de suporte |
| F-32 | Permissões e feature flags | `can()`, `hasFeature()`, `RequirePermission`, `RequireFeature` | Manter | Não | A | matriz por papel × tela; sessão de suporte somente leitura |
| F-33 | Multi-tenant | `currentTenantId` recarrega o quadro; RLS no servidor | Manter | Não | A | troca de tenant; dados não vazam |
| F-34 | Demonstração | `selectRepository` demo/API | Manter | Não | B | modo demo sem API |
| F-35 | Estados vazios e onboarding | `EmptyState`, `useMarkOnboardingVisit`, `?importar=1`, `?novo=1` | Manter os links profundos | Não | M | links do Dashboard/onboarding |
| F-36 | Tema claro/escuro | tokens `theme.css` | Respeitar nos novos componentes | Não | B | contraste nos dois temas |
| F-37 | Toasts e erros descritivos | `useToast`, `describeError` | Manter mensagens | Não | B | mensagens de erro por status |
| F-38 | Modal acessível e proteção de dados | `Modal`, `useDialog` | Reaproveitar (inclusive na importação) | Não | M | foco; Esc; dirty; pilha |

Cobertura de testes atual: utilitários (`pipelineBoard.test.ts`, `stage4.test.ts`, `crmUtils.test.ts`, `permissions.test.ts`), componentes de notificações/automações/conexões e o `WhatsappButton`. **Não há testes de componente para `PipelinePage`, `LeadDrawer`, `LeadImportModal`, `SettingsPage` nem `LeadMessageTemplatesSettings`** — criar antes de alterar (ver 12).
