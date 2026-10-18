# 09 — Responsividade

Verificada no **navegador real** (Chromium) em **1920×1080, 1366×768, 768×1024 e 390×844**, nos temas **claro e escuro**. Critério fixo em todas as combinações: **sem rolagem horizontal da página** (`scrollWidth − clientWidth ≤ 1`) e diálogos contidos na janela.

| Tela / fluxo | Suíte | 1920 | 1366 | 768 | 390 | Claro | Escuro |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Pipeline (cabeçalho, filtros, colunas / abas no celular) | `a11y-visual.spec.ts`, `redesign.spec.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Painel do lead (leitura e edição) | `a11y-lead-import.spec.ts`, `lead-drawer.spec.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Assistente de CSV (5 etapas) | `a11y-lead-import.spec.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Configurações** (Funil de vendas, edição de etapa, Comunicação) | **`a11y-settings.spec.ts`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Diálogo "Marcar como perdido?"** | **`a11y-settings.spec.ts`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

(✅ = rodou e passou. Os demais modais de confirmação — excluir lead/pipeline/etapa/tag/template — foram exercitados nos E2E funcionais com a janela padrão de 1280×720, **sem** auditoria por resolução/tema.)

## Configurações — comportamento por largura

| Largura | Comportamento |
|---|---|
| > 860 px | navegação lateral fixa (240 px) + conteúdo; cartões de seção; grade de pipelines em colunas fluidas |
| ≤ 860 px | navegação vira **seletor "Seção"** + **cartões de atalho** (Notificações, Automações, Equipe, Integrações) acima do conteúdo; campos ocupam 100 % da largura; formulários inline quebram em linhas |
| ≤ 390 px | verificado: nenhuma rolagem horizontal; editar uma etapa (nome, cor, Ganho/Perdido, Salvar/Cancelar/Excluir/setas) cabe sem cortar |

Nenhuma funcionalidade é escondida no celular: tudo que existe no desktop existe no celular (inclusive reordenar etapas pelas setas e excluir com confirmação).

## Menu lateral

Recolhido ≤ 900 px (herdado); foi corrigido nesta fase o destaque duplo de itens (agora um único `aria-current="page"`).

## Não medido

- **Teclado virtual** real (iOS/Android) e dispositivos físicos: apenas emulação do Chromium. O rodapé fixo do painel do lead foi verificado com o campo "Notas" focado, mas sem teclado virtual verdadeiro.
- Firefox/WebKit: usados nos testes funcionais `@cross` (login, quadro, painel, importação e arrastar), **não** nas auditorias de layout por resolução.
- Tablet em **paisagem** e telas > 1920 px; zoom do navegador ≥ 200 %.
