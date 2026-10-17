# 04 — Auditoria do painel de detalhes do lead

Arquivos: `src/components/leads/LeadDrawer.tsx` (598 linhas), `LeadDrawer.module.css`, `utils/leadTimeline.ts`, `hooks/useLeadTimeline.ts`, `hooks/useDialog.ts`. Backend: `leads/adapters/inbound/router.py` (timeline, comentários, PATCH, DELETE).

## Estrutura atual (ordem de rolagem)

Cabeçalho (avatar, nome, empresa) → selos (etapa, WhatsApp, e-mail, "Editar") → grade 2×4 (Etapa, Responsável, Valor, Probabilidade, Telefone, E-mail, Origem, Criado em) → Tags → Notas → (ações de edição) → Tarefas → Atividades (campo de comentário + timeline) → "Excluir lead". Largura `min(460px, 100%)`, uma coluna rolável (`LeadDrawer.module.css:10-19`); a grade vira 1 coluna ≤ 480 px (`:130-140`).

Pontos positivos [C]: `role="dialog"`/`aria-modal`/`aria-label` com o nome do lead (`:210-217`); foco preso e devolvido, Esc/clique-fora protegidos quando há edição ou comentário não salvo (`hasUnsaved`, `:86-87`); pilha de diálogos para a confirmação e o formulário de tarefa (`useDialog.ts:8-13`); sem seções fictícias (comentário do cabeçalho do arquivo).

## Achados

**DRW-01 · P1 · [C]** Campos sem rótulo programático.
Evidência: Valor, Probabilidade, Telefone, E-mail e Origem usam `<div className={styles.fieldLabel}>` seguido do input (`LeadDrawer.tsx:309-384`), sem `<label>`, `htmlFor` ou `aria-label`; só Etapa/Responsável (`<label>`, 269-308) e Nome/Empresa (`aria-label`, 227-240) têm nome acessível. Em leitor de tela, os campos são anunciados sem nome. Recomendação: `<label>`/`htmlFor` ou `aria-labelledby` em todos. Risco: baixo. Backend: não.

**DRW-02 · P1 · [H][V]** Falta um resumo de contexto no topo.
O painel prioriza *dados cadastrais* (8 campos) antes do que importa para vender: última interação, próxima tarefa, atrasos, tempo na etapa. Para "abrir → entender → contatar → registrar → próxima ação", o contato (WhatsApp/e-mail) está num selo pequeno e o registro de interação fica no final da rolagem. Recomendação: cabeçalho de contexto + barra de ações (ver comparação abaixo). Backend: indicadores deriváveis (07).

**DRW-03 · P2 · [C]** Modelo de salvamento misto.
Etapa e Responsável gravam **na hora** ao mudar o select (`handleMove`, `handleAssign`, 94-127), enquanto os demais campos exigem "Editar" → "Salvar alterações" (154-177, 445-458). Quem edita nome e troca a etapa pode achar que tudo foi salvo junto. Recomendação: salvar tudo por campo (inline) ou deixar claro com rótulo "alteração imediata". [D]

**DRW-04 · P2 · [C]** Validação mínima.
O botão só desabilita com nome vazio (`:453`); e-mail não é validado; probabilidade é "clampada" em silêncio para 0–100 (`:163`); telefone é formatado, mas não validado. Recomendação: validação inline com mensagens (e-mail, telefone, probabilidade). Backend: confirmar regras antes de espelhar.

**DRW-05 · P2 · [C]** Timeline limitada a 100 itens sem aviso.
`LeadsApiRepository.timeline` chama `/leads/{id}/timeline` sem `limit` (`:224-225`); o padrão do backend é 100 (máximo 500, `router.py:616-625`). Leads com histórico longo perdem os itens antigos sem indicação. Recomendação: "Ver mais" e/ou paginação; informar o corte. Backend: não (parâmetro existe), cursor opcional.

**DRW-06 · P2 · [D]** "Registrar interação" é só comentário.
O fluxo pede registrar contato (ligação, WhatsApp, e-mail). Hoje só há comentário livre (`:505-521`); o tipo `activity` existe na timeline, mas só é gravado por integrações (API pública, `leads/domain/entities.py` `LeadEventType.ACTIVITY`). Decisão: criar "tipo de interação" na UI? Exige backend para registrar atividades por usuário.

**DRW-07 · P2 · [D]** Vendedor pode excluir os próprios leads.
`DeleteLeadUseCase` só chama `ensure_can_access_lead` (`use_cases.py:619-629`): vendedor dono pode excluir; há auditoria (`lead.deleted`, `router.py:541-575`) e confirmação na UI (`LeadDrawer.tsx:572-581`), mas a regra é permissiva. Decisão de produto/segurança; **não alterar no redesign**.

**DRW-08 · P2 · [C]** Lead aberto no Pipeline não tem URL.
`selectedLeadId` é estado local (`PipelinePage.tsx:146`): sem deep link, botão "voltar" do navegador fecha a página, e não é possível compartilhar o link do lead (em `/leads/:id` isso existe). Recomendação: `?lead=<id>` no Pipeline.

**DRW-09 · P3 · [P]** Botão fechar pequeno.
`.close` é um "✕" de 16 px sem padding/área mínima (`LeadDrawer.module.css:~28-35`). Validar medição.

**DRW-10 · P3 · [C]** Tarefas: criar/concluir apenas.
Sem editar prazo/responsável, sem abrir a tarefa, limite 50 (`useTasks({ pageSize: 50 })`, `:66`) com texto "veja todas em Tarefas" (`:496-500`). O checkbox é um `<button>` com glifos ☑/☐ e `aria-label` (OK), sem `aria-pressed`.

Observações adicionais [C]: tags só aparecem em edição quando existem (`:391-423`) e some a seção quando não há tags — descobrir "adicionar tag" exige clicar em Editar. O botão WhatsApp agora aparece com telefone mesmo sem template (mudança de 2026-10-17, `WhatsappButton.tsx`).

## Abas, seções ou colunas? Comparação

| Alternativa | Vantagens | Riscos |
|---|---|---|
| **A. Abas** Resumo · Atividades · Dados | Menos rolagem; modelo mental familiar | Esconde tarefas/atividades (o que o vendedor mais usa); no celular o painel já é tela cheia; risco de perder rascunho ao trocar de aba (precisa preservar estado) |
| **B. Uma coluna com cabeçalho fixo + seções recolhíveis** | Contexto sempre visível; nada escondido; preserva estado; menor mudança sobre o código atual | Rolagem longa se tudo estiver aberto |
| **C. Duas colunas (dados à esquerda, atividades à direita)** | Aproveita telas largas | Exige largura ≥ 900 px; o painel é lateral de 460 px; mudaria o padrão do app |

**Recomendação: B**, com cabeçalho fixo (identificação, etapa, responsável, WhatsApp/e-mail/ligar, próxima ação) e seções "Atividades" (aberta), "Tarefas" (aberta) e "Dados" (recolhida após o primeiro uso). Abas só se a validação com usuários mostrar que a rolagem atrapalha. Justificativa: o fluxo prioritário passa por contato → registro → próxima ação, e esses itens precisam ficar visíveis simultaneamente; B não exige reescrever o estado do componente.

## Fluxo-alvo e lacunas

1. **Abrir lead** — hoje sem URL no Pipeline (DRW-08).
2. **Entender contexto** — faltam última interação/próxima ação/tempo na etapa (DRW-02).
3. **Entrar em contato** — WhatsApp/e-mail existem; ligar não; ações pequenas.
4. **Registrar interação** — só comentário (DRW-06).
5. **Definir próxima ação** — "+ Nova tarefa" no meio da página; sem atalhos de prazo ("amanhã", "em 3 dias").

## Responsividade e rolagem

Largura total ≤ 480 px; grade em coluna única; `padding-bottom: 60px`. Um único contêiner rola (`overflow-y: auto`), com `body` travado por `useDialog`. Sem teste em aparelho real [V]. O painel é monolítico (598 linhas, estado de edição, tarefas, timeline e exclusão no mesmo componente): para o redesign, extrair subcomponentes (cabeçalho, grade de dados, tarefas, atividades) antes de mudar o visual.
