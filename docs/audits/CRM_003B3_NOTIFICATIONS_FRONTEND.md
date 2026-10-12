# CRM-003B.3 — Frontend da Central de Notificações

Consome as APIs reais do CRM-003B.2 (backend, ADR 0014). **Nenhuma ação desta
tela envia mensagem**: o canal WhatsApp só existe no CRM-003B.8 (via n8n). Não
há chamada a n8n, Google ou Microsoft, nem botão "Enviar teste".

## Telas e rotas

| Rota | Quem | O que tem |
|---|---|---|
| `/configuracoes/notificacoes` | Feature `notifications` + permissão `notifications.view` (admin, gestor) | Abas: **Política da empresa** (habilitação, perfis que recebem, horário, fuso, fins de semana, escopo, tarefas, leads, atrasados, agenda, oportunidades, alerta de novo lead, limites), **Por perfil**, **Destinatários**, **Prévia**, **Histórico** |
| `/perfil/notificacoes` | Feature `notifications` (qualquer membro) | Abas: **Preferências** (reduz o que a empresa permite, fuso individual, telefone, consentimento), **Prévia**, **Meu histórico** |

Atalhos: link em Configurações e em Meu perfil, visíveis só com a feature
liberada para o tenant. Os dois chunks são carregados sob demanda (lazy).

## Permissões (a UI só evita prometer o que o backend recusa)

| Ação | Admin | Gestor | Vendedor | Suporte (impersonation) |
|---|---|---|---|---|
| Ver política / destinatários | sim | sim | não (rota bloqueada) | sim (leitura) |
| Editar política e ajustes por perfil | sim | não | não | **não** (403 no backend) |
| Preferências, telefone, consentimento | próprias | próprias | próprias | **não** |
| Prévia | qualquer membro | só a própria | só a própria | — |
| Histórico | do tenant | do tenant | só o próprio | — |

Fonte: `PATCH /settings` = admin + `forbid_impersonation`; `/recipients` =
admin/gestor; `PATCH /preferences/me` = membro ativo + `forbid_impersonation`;
`/preview` de outra pessoa = admin (backend). Permissões novas em
`src/auth/permissions.ts`: `notifications.view` e `notifications.manage`
(bloqueada em suporte).

## Contratos usados (verificados contra o B.2)

`src/services/NotificationsService.ts` · mapeamento em `src/utils/notifications.ts`

| Método e rota | Uso |
|---|---|
| `GET /api/v1/notifications/settings` | política, ajustes por perfil, `version`, configuração efetiva |
| `PATCH /api/v1/notifications/settings` | `{version, policy?, roles?}` parcial; 409 se `version` divergir |
| `GET/PATCH /api/v1/notifications/preferences/me` | `{version, preferences?, reset_preferences?, timezone?, whatsapp?{phone,consent,enabled}}` |
| `GET /api/v1/notifications/recipients` | membros, telefone **mascarado**, consentimento, motivo |
| `POST /api/v1/notifications/preview` | `{kind, recipient_user_id?}` — não grava nem envia |
| `GET /api/v1/notifications/deliveries` | paginado; filtros `kind`, `status`, `recipient_user_id`, `date_from`, `date_to` |

Verificação feita no card: os 10 modelos de resposta do backend (72 campos) são
todos lidos pelo mapeamento, e os corpos gerados pelo frontend (com todos os
campos alterados) foram aceitos pelos modelos Pydantic reais
(`extra="forbid"`). Nenhuma incompatibilidade encontrada.

## Regras de experiência

- **Salvar é sempre explícito**; navegar pelos campos nunca dispara requisição.
- **PATCH parcial** (`policyPatch`): só o que mudou, com a `version` lida.
- **409**: "alteradas em outra sessão", nada é sobrescrito, botão para recarregar.
- **Ajuste por perfil esparso** (`roleOverrideBody`): leva só o que diverge da
  política da empresa — o perfil continua acompanhando a empresa no resto.
- **Preferência pessoal só reduz**: modos e limites acima do teto da empresa não
  são oferecidos; campos bloqueados mostram o motivo; `restricted_fields` do
  backend aparece em texto.
- **Consentimento explícito**: caixa nunca pré-marcada, texto claro, revogável.
  Telefone novo avisa que a autorização/verificação deixam de valer; a tela
  segue o estado devolvido pela API. Nenhum número aparece como verificado.
- **Histórico**: `skipped` e `channel_unavailable` aparecem como "Não enviada",
  com o motivo, e há aviso fixo de que o WhatsApp ainda não está disponível.
- Estados tratados: carregando, vazio, rede, 401/403, feature indisponível,
  409, validação (422), salvando/salvo/falha, sem consentimento, sem telefone,
  canal indisponível, demonstração (API real apenas).

## Liberação controlada da feature `notifications`

Estado atual (backend B.1): `notifications` está **reservada** —
`available=False`, `default_enabled=False`. O Super Admin **não consegue**
ligá-la (422 em provisionamento e no `PUT /platform/tenants/{id}/features`) e
`/auth/me` devolve `features.notifications=false`. O frontend respeita isso:
rotas, atalhos e menu não aparecem, e não há como burlar pela interface.

Nada foi alterado no backend neste card. Para a homologação (B.7) é preciso
decidir **como destravar sem expor em produção**:

1. **Recomendada** — disponibilidade por ambiente: `available` passa a depender
   de uma variável (ex.: `NOTIFICATIONS_FEATURE_AVAILABLE`, default `false`),
   ligada só em QA/homologação. Em produção segue reservada até a decisão final.
   Mudança mínima em `app/shared/features.py` + teste do catálogo.
2. Alternativa — marcar `available=True` (mantendo `default_enabled=False`).
   Ninguém passa a ter a feature automaticamente: o Super Admin liga tenant a
   tenant (auditado em `tenant.features_updated`). Mais simples, porém libera a
   opção para qualquer tenant em produção assim que for ao ar — exige disciplina
   de processo.

Em ambos os casos, a ativação por cliente é feita pela tela da plataforma
(Organização → Funcionalidades) ou pelo `PUT /platform/tenants/{id}/features`,
nunca por SQL. Sem a decisão acima, as telas não podem ser exercitadas de ponta
a ponta fora dos testes automatizados.

## Fora do escopo (próximos cards)

OAuth e sincronização Google/Microsoft (B.4–B.6), e-mail comercial via
`mailto:`, envio por WhatsApp e workflows n8n (B.8).
