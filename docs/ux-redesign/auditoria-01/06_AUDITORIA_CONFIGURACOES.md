# 06 — Auditoria das Configurações

Arquivos: `src/pages/SettingsPage.tsx` (785), `SettingsPage.module.css`, `components/leads/LeadMessageTemplatesSettings.tsx` (234), `utils/leadMessageTemplates.ts`, `routes/index.tsx:175-190`. Backend: `pipelines/adapters/inbound/router.py`, `leads/adapters/inbound/router.py:660-720` (templates), `acquisition_router.py` (origens).

## Arquitetura de informação atual

`/configuracoes` é **uma página única** com, em sequência: links (Automações, Notificações) → Pipelines e etapas → Tags → Origens → Mensagens de WhatsApp do pipeline → *(só staff GSM)* Prospecção: estágios, mensagens, IA. Rotas próprias que já existem: `/configuracoes/integracoes`, `/configuracoes/automacoes`, `/configuracoes/notificacoes`, além de `/perfil/notificacoes` e `/perfil/conexoes`. **Integrações não é linkada** nesta página (só no menu lateral).

## Achados

**CFG-01 · P1 · [C]** Página monolítica que mistura públicos e responsabilidades.
Evidência: 785 linhas, 15 `useState`, 8 seções (`SettingsPage.tsx`); seções internas da GSM aparecem na mesma página para staff (`:627-781`); a navegação para as demais configurações é um parágrafo de links (`:298-309`). Usuário comum precisa rolar uma página longa para achar Tags ou Mensagens; staff GSM vê configurações de outro produto (Prospecção) misturadas. Recomendação: layout com navegação lateral/abas por rota (ver abaixo). Risco: médio (mover blocos sem alterar lógica).

**CFG-02 · P1 · [C]** Exclusões destrutivas sem confirmação.
Evidência: remover **tag** executa direto (`handleDeleteTag`, `:~270-280`; botão `:599-606`); excluir **template** idem (`LeadMessageTemplatesSettings.tsx:46-54, 115-121`). Já etapas e pipelines usam `ConfirmDialog` (`SettingsPage.tsx:546-559`). Inconsistência e risco de perda de dados (tag removida sai de todos os leads). Recomendação: `ConfirmDialog` com a contagem de itens afetados quando disponível.

**CFG-03 · P2 · [C]** Excluir etapa apaga templates da etapa sem avisar.
`lead_message_templates.stage_id` tem `ondelete="CASCADE"` (`leads/adapters/outbound/models.py:~238`); a mensagem do `ConfirmDialog` (`SettingsPage.tsx:546-551`) só fala de leads. O backend recusa excluir etapa com leads (409) e pipeline com leads (409) — comportamento correto a preservar (`pipelines/adapters/outbound/repository.py:221-233, 81-93`); o pipeline padrão e o único pipeline também não podem ser excluídos (`use_cases.py:128-150`).

**CFG-04 · P2 · [D]** "Origens" é uma lista estática; o backend tem origens configuráveis.
`SettingsPage.tsx:611-620` renderiza `Object.values(ORIGIN)` (constantes do frontend). O backend expõe `/api/v1/lead-sources` (Etapa 6, `acquisition_router.py:80`) com fontes configuráveis, tipo de aquisição ativo/passivo e cadências; o frontend de leads não usa (`origin` enum apenas). Decidir se Tags e **Origens** passam a ser configuráveis (exige UI nova, backend pronto).

**CFG-05 · P2 · [C]** Criar etapa não permite marcar Ganho/Perdido.
O formulário de nova etapa só tem nome e cor (`:~490-515`); marcar ganho/perdido exige criar e depois editar. Ganho/perdido é o que alimenta conversão e receita (`PipelinePage.tsx:287-291`).

**CFG-06 · P2 · [C]** Campos sem rótulo.
Placeholders como única identificação: "Nome do novo pipeline…" (`:315-320`), "Nome da nova tag…" (`:567-572`), nome da etapa em edição sem `aria-label` (`:~411-415`). Cores têm `aria-label` (positivo).

**CFG-07 · P2 · [C]** Formulário de template: sem rótulos, sem prévia, placeholders frágeis.
Os dois `select` e o `textarea` não têm rótulo (`LeadMessageTemplatesSettings.tsx:187-216`); não há prévia; placeholders ausentes viram vazio ("Olá , tudo bem?") porque `renderLeadMessage` substitui por `""` (`leadMessageTemplates.ts:34-39`); placeholders desconhecidos (ex.: `{telefone}`) permanecem literais. Não há contador, nem validação de placeholders.

**CFG-08 · P3 · [C]** Comentário desatualizado sobre permissão ("aberto pra qualquer usuário do tenant", `LeadMessageTemplatesSettings.tsx:32-37`) — a rota exige `settings.manage` (`routes/index.tsx:175`) e o backend `require_tenant_role` (`router.py:660-705`).

**CFG-09 · P2 · [H]** Reordenar etapas é descobrível só ao clicar na etapa.
As setas "←/→" ficam dentro do modo de edição de cada etapa (`:464-478`); a dica é `title` ("Clique para editar, reordenar ou excluir", `:497`) — inacessível em toque. Acessível por teclado, sim.

## Comportamento real dos templates (documentado, não alterar)

- Chave: `(stage_id, origin)`; `origin = null` é o coringa da etapa (`types/lead.ts` `LeadMessageTemplate`).
- **Precedência** (`findMatchingLeadTemplate`, `leadMessageTemplates.ts:14-25`): template específico da origem do lead na etapa atual → coringa da etapa → nenhum. Não cai para outras etapas.
- Duplicidade `(stage, origin)` retorna 409; a UI mostra a mensagem no formulário (`LeadMessageTemplatesSettings.tsx:174-176`).
- Editar não permite trocar a etapa (select desabilitado, `:191`).
- Placeholders: `{nome}`, `{empresa}`, `{cidade}`, `{estado}`.
- Desde 2026-10-17 o botão de WhatsApp aparece sempre que o lead tem telefone; **sem template abre a conversa em branco**, com template abre com a mensagem. (A precedência acima não mudou.)

## Pipelines e etapas — operações e consequências

| Operação | UI | Backend / consequência |
|---|---|---|
| Criar pipeline | campo + "Adicionar" | semeia etapas padrão (Novo, Em contato, Proposta, Ganho, Perdido) |
| Pipeline padrão | "Tornar padrão" | é onde entram os leads de integrações; aviso se nenhum for padrão (`:~330-337`) |
| Excluir pipeline | `ConfirmDialog` | 409 com leads, 409 se padrão, 409 se for o único |
| Criar etapa | nome + cor | ganho/perdido só ao editar (CFG-05) |
| Editar etapa | nome, cor, ganho/perdido exclusivos | recusado se tornaria o pipeline sem etapa aberta |
| Reordenar | setas; arrastar coluna no Pipeline | exige a permutação completa das etapas do pipeline |
| Excluir etapa | `ConfirmDialog` | 409 com leads; **apaga templates da etapa** (CFG-03); mantém ao menos uma etapa aberta |

## Arquitetura proposta

`/configuracoes` vira um *layout* com navegação lateral (menu horizontal rolável no celular) e sub-rotas:

1. **Pipelines e etapas** (`/configuracoes/pipelines`) — cartão por pipeline; etapas em lista ordenável; criação de etapa com ganho/perdido.
2. **Tags e origens** (`/configuracoes/tags`) — origens somente leitura até a decisão CFG-04.
3. **Mensagens comerciais** (`/configuracoes/mensagens`) — matriz etapa × origem com prévia.
4. **Automações** (`/configuracoes/automacoes`) · 5. **Notificações** (`/configuracoes/notificacoes`) · 6. **Integrações** (`/configuracoes/integracoes`) — rotas atuais, só entram no menu.
7. **Prospecção (equipe GSM)** — agrupar e rotular como área interna, visível apenas a staff.

Preservar: guardas (`settings.manage`, `integrations.manage`, `automations.view`, `notifications.view`), redirecionamento de `/configuracoes` para a primeira sub-rota e os links existentes (`ROUTES.*`), pois onboarding e estados vazios apontam para eles (`PipelinePage.tsx:219`, `DashboardPage.tsx:198`).
