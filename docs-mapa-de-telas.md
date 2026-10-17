# GSM CRM — mapa de telas e modais

Levantado a partir das rotas (`src/routes/index.tsx`) e dos componentes. **Não é uma inspeção tela a tela com o app aberto**: títulos, rotas e permissões são reais; o "o que faz" vem do nome do componente e do que já conversamos, e pode estar incompleto. Telas marcadas com (*) eu não abri.

Legenda de acesso: **Admin** / **Gestor** / **Vendedor**; **Staff GSM** = equipe interna da GSM (área SDR/Clientes GSM, não contratável); **Feature** = precisa estar ligada para a empresa.

## 1. Acesso (sem login)
| Rota | Tela | Observação |
|---|---|---|
| `/login` | Entrar | e-mail e senha |
| `/esqueci-senha`, `/redefinir-senha` | Recuperar senha | link por e-mail |
| `/trocar-senha` | Troca obrigatória | primeiro acesso ou senha temporária |

## 2. CRM (cliente passivo = leads)
| Rota | Tela | Acesso | O que faz |
|---|---|---|---|
| `/dashboard` | Dashboard | feature `dashboard` | indicadores do funil; filtro Passivo/Ativo para staff |
| `/pipeline` | Pipeline | feature `crm` | quadro por etapas, arrastar cards, filtros de período/responsável, **Importar planilha**, **Exportar CSV** |
| `/leads`, `/leads/:id` | Leads | feature `crm` | lista, busca, **+ Lead**; abre o painel do lead |
| `/tarefas` | Tarefas | feature `crm` | abas Hoje, Atrasadas, Futuras, Concluídas; inclui tarefas do Google/Microsoft |
| `/agenda` | Agenda | feature `crm` | grade estilo Google; compromissos do CRM e importados |
| `/relatorios` | Relatórios | feature `reports` | relatórios comerciais |
| `/equipe` | Equipe | Admin, Gestor | pessoas, papéis, **Convidar pessoa** |
| `/perfil` | Meu perfil | todos | dados, links para notificações e conexões |

## 3. Configurações
| Rota | Tela | Acesso |
|---|---|---|
| `/configuracoes` | Configurações: pipelines e etapas, tags, origens, mensagens de WhatsApp por etapa; links para Automações e Notificações | Admin, Gestor |
| `/configuracoes/integracoes` | Integrações: credenciais de API e webhooks | Admin |
| `/configuracoes/automacoes` | Automações comerciais (5 automações) | Admin edita, Gestor consulta |
| `/configuracoes/notificacoes` | Notificações da empresa: política, por perfil, destinatários, prévia, histórico | Admin edita, Gestor consulta; feature `notifications` |
| `/perfil/notificacoes` | Minhas notificações: preferências, **telefone e consentimento**, prévia, meu histórico | todos; feature `notifications` |
| `/perfil/conexoes` (+ `/perfil/conexoes/callback`) | Minhas conexões Google/Microsoft | todos; feature `calendar_task_integrations` |

## 4. Área interna GSM (cliente ativo) — Staff GSM
`/clientes` (Clientes GSM), `/sdr/campanhas` (+ nova, editar, execução), `/sdr/presets`, `/sdr/candidates` (+ detalhe), `/sdr/cobertura`, `/sdr/prospectar-hoje`, `/sdr/dashboard`. Para quem não é staff aparece "Página não encontrada" de propósito. (*) Não abri nenhuma.

## 5. Plataforma (Super Admin GSM)
`/platform` (visão geral), `/platform/organizations` (+ nova, detalhe), `/platform/audit`, `/platform/support-sessions`.

## 6. Modais e diálogos
| Onde | Modal | Para que serve |
|---|---|---|
| Leads / Pipeline | **Novo lead** | cadastro com campos obrigatórios marcados com * |
| Pipeline | **Importar leads via CSV** | enviar .csv, mapear colunas (de/para) e escolher o que fazer quando o telefone já existe |
| Painel do lead | **Excluir lead?** | confirmação |
| Tarefas, painel do lead | **Nova tarefa / Editar tarefa** | título, prazo, responsável |
| Tarefas | **Excluir tarefa?** | confirmação |
| Agenda | **Novo compromisso / Editar compromisso** | formulário |
| Agenda | **Detalhes do compromisso** | leitura; importados do Google/Outlook são somente leitura |
| Agenda | **Excluir compromisso?** | confirmação |
| Configurações | **Excluir etapa? / Excluir pipeline?** | confirmação |
| Equipe | **Convidar pessoa** | nome, e-mail, papel; opção de senha temporária |
| Equipe | **Desativar usuário?** | confirmação |
| Minhas conexões | **Escolher calendários e listas** | só o marcado é sincronizado |
| Minhas conexões | **Desconectar esta conta?** | confirmação |
| Integrações | **Nova credencial de API**, **Rotacionar**, **Revogar credencial**, exibição única do secret | gestão de chaves |
| Integrações | **Novo/Editar webhook**, **Excluir webhook**, **Gerar novo secret**, **Detalhe da entrega** | webhooks para n8n/sistemas |
| Banner de suporte | **Liberar escrita nesta sessão?** | sessão de suporte GSM |
| SDR | **Iniciar garimpo** | modo de busca de prospects |
| Prospects | **Mover todos de "etapa"**, **Prospects movidos**, **Importar resposta da IA**, **Substituir as mensagens?** | ações em lote e mensagens por IA |
| Plataforma | **Editar organização**, **Suspender/Reativar**, **Sessão de suporte em…**, **Encerrar sessão de suporte?** | gestão de clientes da GSM |

## 7. O que não está aqui
Recorrência de tarefas e agenda (ainda não existe); relatórios semanal e mensal por WhatsApp (ainda não existem).
