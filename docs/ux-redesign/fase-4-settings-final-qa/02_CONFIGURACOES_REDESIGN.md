# 02 — Redesign das Configurações

## Diagnóstico (antes)

`SettingsPage.tsx` tinha **805 linhas** numa única rota (`/configuracoes`): uma página longa com Pipelines, Tags, Origens, mensagens de WhatsApp e — só para staff GSM — Prospecção (estágios, mensagens, IA). Dois links soltos no topo (Automações, Notificações) sem hierarquia; ações cifradas (`✎`, `✕`); estado de ~25 `useState` no mesmo componente; nenhuma explicação do efeito das operações.

## Decisões

1. **Mesma rota, categorias por `?secao=`** — nenhuma rota nova (sem impacto em links, permissões ou menu). A URL é compartilhável e o botão "voltar" do navegador funciona.
2. **Navegação lateral por categoria** (desktop) e **seletor compacto + cartões de atalho** (≤ 860 px). Sem abas horizontais.
3. **Seções em componentes**, cada uma dona das próprias chamadas e estados; a página só decide *o que* aparece.
4. **Nada de regra nova**: mesmas operações, mesmos endpoints, mesmas confirmações; o backend segue como autoridade.

## Estrutura

```
Configurações                       (h1)
├─ Funil de vendas
│    └─ Pipelines, tags e origens   ← categoria "comercial" (padrão)
│         · Pipelines e etapas · Tags · Origens (somente leitura, D-04)
├─ Comunicação
│    ├─ Mensagens de WhatsApp       ← categoria "comunicacao" (templates por etapa/origem)
│    └─ Notificações  →  /configuracoes/notificacoes   (feature + permissão)
├─ Automação
│    └─ Automações comerciais →  /configuracoes/automacoes   (feature crm + automations.view)
├─ Equipe e acesso
│    └─ Equipe e usuários →  /equipe                          (users.view)
├─ Integrações
│    └─ Integrações →  /configuracoes/integracoes             (integrations.manage + feature api/webhooks)
└─ Área interna da GSM  (SÓ staff)
     └─ Prospecção (GSM)           ← categoria "interno": estágios, mensagens, IA dos textos
```

- Os **atalhos** para telas vizinhas aparecem **só** para quem tem permissão/feature (mesmos critérios do menu lateral). Não substituem a guarda de rota nem a do backend.
- `?secao=interno` para quem **não** é staff volta ao padrão (nunca renderiza a área interna). A separação "cliente × ferramentas internas" continua sendo apenas **visual** (recomendação não aprovada de mover para outra rota/área administrativa **não** foi implementada).

## Componentes (`src/components/settings/`)

| Arquivo | Papel |
|---|---|
| `SettingsNav.tsx` | navegação (botões das categorias + links de atalho); `useMediaQuery` escolhe desktop/compacto (um só DOM por vez) |
| `SettingsCard.tsx` | cartão de seção: título (`h2`), explicação curta, ação principal à direita, selo "interno GSM" |
| `PipelinesSection.tsx` | pipelines e etapas (código migrado sem mudança de regra) |
| `TagsSection.tsx` | tags |
| `OriginsSection.tsx` | origens fixas |
| `ProspectStagesSection.tsx` | estágios da Prospecção (interno) |
| `Settings.module.css` | estilos (só tokens do Design System) |

`SettingsPage.tsx`: **805 → 118 linhas**.

## Melhorias de clareza (sem mudar comportamento)

- Descrição de cada seção ("o que é / quem é afetado").
- Ações com **texto** ("✎ Editar", "✕ Excluir") mantendo o nome acessível anterior (`aria-label` "Editar pipeline X").
- Estados vazios acionáveis (tags: "Nenhuma tag criada ainda…").
- Etapa em edição explica que **Ganho e Perdido são exclusivos** e que **mover um lead para Perdido pede confirmação** (D-03).
- Mensagens de impacto das exclusões **preservadas**: etapa ("só sem leads… templates da etapa também serão excluídos"), pipeline ("só sem leads"), tag ("os leads não são excluídos").
- Chips de etapa: ponto colorido + texto na cor do tema (contraste não depende da cor escolhida pelo usuário).

## Salvamento e alterações não salvas

Persistência **inalterada** (cada ação salva ao confirmar, com toast); **sem autosave**. Os formulários inline de pipeline/etapa/tag/template são curtos e se descartam por "Cancelar"; **não** foi adicionado diálogo de "descartar alterações" (impacto baixo e seria ruído). Pendência P3 em `14`.

## Correções de acessibilidade achadas pelo axe nesta fase

| Achado | Correção |
|---|---|
| Selo "Padrão" do pipeline (cores fixas) com contraste insuficiente no tema claro | cores do tema (`--accent-soft` / `--accent-bg`) |
| Botão `danger` (vermelho) com 4,07:1 no tema claro (afetava **todos** os diálogos de exclusão) | `color-mix` com o mesmo `--badge-mix` já usado nos selos (tema escuro intacto) |
| Chips de etapa e de origem (cor de dados sobre cinza) abaixo de 4,5:1 | texto na cor do tema + ponto/ícone colorido |
| `<code>` dos placeholders de template (tema escuro) com 4,33:1 | `--text-dim` |
