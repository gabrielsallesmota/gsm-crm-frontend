# 03 — Matriz de preservação funcional (Configurações)

Legenda de teste: **U** = Vitest (`tests/ui/settingsPage.spec.tsx`, 49 casos, F-24…F-31) · **E** = Playwright `e2e/settings.spec.ts` (API real) · **B** = teste de backend.
Permissão: `settings.manage` = ADMIN e GESTOR (escrita de pipelines/etapas/tags/templates); staff = `platform.internal`.

| Funcionalidade | Local anterior | Novo local | Permissão | Teste de preservação |
|---|---|---|---|---|
| Listar pipelines e etapas | Configurações › Pipelines | Funil de vendas › Pipelines e etapas | settings.manage | U "lista os pipelines com etapas…" · E fluxo completo |
| Criar pipeline (só nome; cor padrão) | idem | idem | settings.manage | U "criar pipeline" · E |
| Renomear / trocar cor do pipeline (Salvar/Cancelar; nome em branco desabilita) | idem | idem | settings.manage | U "renomear/cor…", "nome em branco…" |
| Tornar pipeline padrão | idem | idem | settings.manage | U "tornar padrão…" |
| Aviso "nenhum pipeline padrão" (integrações sem destino) | idem | idem | — | U "sem nenhum pipeline padrão…" |
| Excluir pipeline (confirma; padrão e único não têm botão; 409 com leads vira toast) | idem | idem | settings.manage | U "excluir pipeline…", "pipeline com leads…", "o pipeline padrão NÃO tem botão…" · E |
| Erro ao carregar pipelines + "Tentar de novo" | idem | idem | — | U "erro ao carregar os pipelines…" |
| "Criar estágios padrão" em pipeline sem etapas (sequencial) | idem | idem | settings.manage | U "pipeline sem etapas…" |
| Criar etapa (nome + cor, sem Ganho/Perdido) | idem | idem | settings.manage | U "criar etapa…" · E |
| Editar etapa (nome aparado, cor, Ganho/Perdido **exclusivos**) | idem | idem | settings.manage | U "editar…" ×2 · E |
| Reordenar etapas (setas; permutação completa) | idem | idem | settings.manage | U "reordenar com as setas…" |
| Excluir etapa (confirma e **avisa sobre templates**; 409 com leads) | idem | idem | settings.manage | U "CFG-03…", "etapa com leads…" · E |
| Marcadores 🏆 / ✕ nas etapas finais | idem | idem | — | U "etapas finais mostram…" |
| Listar / criar tag (nome aparado, cor, fundo derivado) | Configurações › Tags | Funil de vendas › Tags | settings.manage | U "lista as tags", "criar tag…" · E |
| Tag duplicada → toast do servidor | idem | idem | — | U "tag duplicada…" |
| Remover tag (confirma citando a tag; Esc devolve foco; falha mantém diálogo) | idem | idem | settings.manage | U CFG-02 ×4 · E |
| Erro ao carregar tags (resto da página segue) | idem | idem | — | U "erro ao carregar as tags…" |
| Origens: 8 fixas, somente leitura (**D-04**) | Configurações › Origens | Funil de vendas › Origens | — | U "origens: lista ESTÁTICA…" · E "origens: conjunto fixo…" |
| Templates de WhatsApp (leads): listar, criar (coringa/específico), editar, excluir, duplicidade 409 no formulário | Configurações › Pipeline — mensagens de WhatsApp | Comunicação › Mensagens de WhatsApp | settings.manage | U F-28 (15 casos) · E "template de WhatsApp…" |
| Seletor de etapa do template prefixa o pipeline quando há mais de um | idem | idem | — | U "etapas de todos os pipelines…" |
| Link para Automações comerciais | topo da página | Automação › Automações comerciais | crm + `automations.view` | U "admin vê o link…", "gestor vê…", "sem a feature crm…" · E |
| Link para Notificações | topo da página | Comunicação › Notificações | feature notifications + `notifications.view` | U "admin vê o link de Automações; o de Notificações só com a feature…" |
| Prospecção — Estágios (criar/editar/excluir) | Configurações (staff) | Área interna da GSM › Prospecção (GSM) | `platform.internal` | U "áreas internas… só para staff", phase1bProspectA11y |
| Prospecção — mensagens de WhatsApp | idem | idem | `platform.internal` | idem |
| Prospecção — IA dos textos | idem | idem | `platform.internal` | idem |
| Nomes acessíveis dos campos (pipeline, etapa, tag, template) | — | — | — | U CFG-06/CFG-07 · a11yBaseline |

## Novidades que NÃO são funcionalidade nova (apenas atalhos de navegação)

| Item | Observação |
|---|---|
| Atalho "Equipe e usuários" → `/equipe` | página e permissão já existiam (`users.view`) |
| Atalho "Integrações" → `/configuracoes/integracoes` | página e permissão já existiam (`integrations.manage` + feature api/webhooks) |
| Seletor de seção no celular | substitui a navegação lateral |

## Resultado

**Nenhuma funcionalidade removida ou alterada em regra.** As diferenças são de **onde** aparece (categorias) e de **texto de apoio**. Os testes de Vitest das Configurações foram ajustados **somente** para navegar até a categoria certa (`route: "/?secao=…"`) e para o novo título "Pipelines e etapas"; nenhum caso foi removido (44 → 49 com os novos de navegação e o de regressão do formulário).

## Operações destrutivas — impacto comunicado

| Operação | Confirmação | Aviso de impacto |
|---|---|---|
| Excluir pipeline | sim | "só é possível excluir um pipeline sem leads" |
| Excluir etapa | sim | "só etapa sem leads; templates da etapa também serão excluídos" |
| Remover tag | sim | "os leads não são excluídos" |
| Excluir template | sim | identifica etapa, origem e mensagem |
| Excluir estágio de Prospecção (interno) | **não** (comportamento herdado) | — · pendência P3 |
