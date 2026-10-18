# 08 — Acessibilidade (WCAG 2.2 AA)

> **Não declaro conformidade integral com a WCAG.** Esta fase mediu o que a automação e os testes de navegador conseguem medir. **A validação com leitor de tela real NÃO foi executada** (ver 8.2).

## 8.1 Medido (navegador real, Playwright + axe-core, regras de A/AA 2.0, 2.1 e 2.2)

| Suíte | Telas e estados | Combinações | Resultado |
|---|---|---|---|
| `a11y-visual.spec.ts` (Prompts 05/06) | Pipeline e importação | 4 resoluções × 2 temas | ✅ 0 violações das regras fixas |
| `a11y-lead-import.spec.ts` (Prompt 07) | Painel do lead (leitura e edição com erro) e as 5 etapas do assistente de CSV | 4 × 2 | ✅ 16/16 |
| **`a11y-settings.spec.ts` (Prompt 08)** | **Configurações** (Funil de vendas; etapa em edição; Comunicação/templates) e **diálogo "Marcar como perdido?"** | 4 × 2 | ✅ **16/16**, após 4 correções (abaixo) |

Regras tratadas como **bloqueantes** (falha o teste): `color-contrast`, `button-name`, `select-name`, `label`, `link-name`, `aria-dialog-name`, `aria-*` (válidos/obrigatórios/permitidos), `nested-interactive`, `duplicate-id-aria`, `aria-hidden-focus`, `list`/`listitem`, `aria-required-children/parent`, `scrollable-region-focusable`, `heading-order`, `region` (as duas últimas só nas Configurações) e qualquer impacto `critical`. As demais violações seriam gravadas em `e2e/.artifacts/axe-*.json` (não houve).

### Defeitos reais que o axe encontrou **nesta fase** (e foram corrigidos)

| Achado | Onde afetava | Correção |
|---|---|---|
| Botão `danger` com 4,07:1 no tema claro | **todos** os diálogos de exclusão do app | mistura com `--badge-mix` |
| Selo "Padrão" (cores fixas) | Configurações | tokens do tema |
| Chips de etapa/origem abaixo de 4,5:1 (cor escolhida pelo usuário sobre cinza) | Configurações | texto do tema + ponto/ícone colorido |
| `<code>` dos placeholders (4,33:1, tema escuro) | templates (leads e Prospecção) | `--text-dim` |

## Verificado por testes funcionais (jsdom e navegador)

| Requisito | Evidência |
|---|---|
| Diálogos: papel, nome, `aria-modal`, foco preso, **retorno do foco**, Esc | `useDialog`; testes F-13/F-20, E2E (Esc no diálogo de perdido fecha sem mover) |
| Esc/clique fora **não** descartam trabalho; só o botão, com confirmação | UI + E2E (painel do lead) |
| Formulário: `label`/`htmlFor`, `aria-required`, `aria-invalid` + `aria-describedby` + `role="alert"`, foco no 1º campo inválido | UI + E2E |
| Navegação das Configurações: `nav` nomeado, categoria ativa com `aria-current="page"`, links nomeados | UI |
| Menu lateral com **um** `aria-current="page"` (corrigido nesta fase) | E2E |
| Progresso da importação (`<progress>` nomeado, `role="status"`) | UI + E2E |
| Alvos de toque ≥ 32 px (fechar 40, check de tarefa 32, ações 36) | desenho + E2E de celular |
| **Alternativa ao arrastar** | seletor "Mover … para outra etapa" no cartão (teclado/toque), testado nos dois caminhos de D-03 |
| Não depender só de cor | tipo do evento em texto; erros em texto; "obrigatório"/"Atrasada" em texto; etapa de perda com ✕ + texto |

## 8.2 Leitor de tela real — **NÃO EXECUTADA**

| Item | Situação |
|---|---|
| NVDA (Windows) | **não executado** — não há leitor de tela instalado/operado neste ambiente automatizado |
| VoiceOver (macOS/iOS), TalkBack, JAWS | **não executados** — sem dispositivos |
| O que isso significa | a árvore de acessibilidade e os atributos foram verificados por ferramenta, mas **ordem de leitura, anúncios dinâmicos (toasts, `role=status/alert`), nomes em contexto e a experiência de arrastar/mover** precisam de uma pessoa com leitor de tela |
| Roteiro mínimo recomendado | (1) Pipeline: ouvir cartão → "Mover … para outra etapa" → confirmar "perdido"; (2) Painel: abrir, editar com erro, salvar, comentar; (3) Importação: 5 etapas e o anúncio do progresso; (4) Configurações: trocar de categoria e excluir uma tag |

→ **Pendência de homologação P1** (`14`): condiciona a liberação a clientes.

## Limitações adicionais

- Navegação por teclado exercitada em Playwright (Tab/Esc/Enter) apenas nos fluxos listados; sem teste de voz/switch.
- Contraste/axe **não** foi rodado em Agenda, Tarefas, Relatórios, Equipe, Dashboard, SDR/Prospecção e Plataforma.
- `prefers-reduced-motion`: animações herdadas (`gsmFade`, 0,2 s) não foram alteradas.
- Zoom/reflow a 200–400 % e texto ampliado: não testados além dos 4 tamanhos de janela.
