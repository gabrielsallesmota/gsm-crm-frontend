# 06 — Falhas conhecidas (documentadas, **não corrigidas** nesta fase)

Nada abaixo foi corrigido: a Fase 0 só mede. "Teste" = quem guarda a falha. `it.fails` (frontend) fica verde **enquanto o defeito existe** e passa a falhar quando ele for corrigido — o sinal para converter em teste comum. Falhas de comportamento (não de acessibilidade) estão protegidas por testes de **caracterização** com "(caracterização — ID)" no nome.

## Classificação

- **FALHA CONHECIDA** — já listada na Auditoria 01.
- **FALHA NOVA** — descoberta nesta fase.
- **ERRATA** — afirmação da Auditoria 01 que os testes provaram imprecisa.
- **MANUAL** — exige validação fora da automação.

## FALHA CONHECIDA (14 testes `it.fails` + caracterizações)

| ID | Falha | Teste | Prio |
|---|---|---|---|
| PIP-01 | Cartão `role="button"` contém controles interativos (3 aninhados) | `a11yBaseline` `[FALHA CONHECIDA PIP-01]` | P1 |
| PIP-04 | Reordenar colunas só por arrastar no quadro | `[… PIP-04]` | P2 |
| DRW-01 | Campos do painel em edição sem nome acessível | `[… DRW-01]` | P1 |
| IMP-01 | Importação sem `role=dialog`/`aria-modal` | `[… IMP-01]` (2 testes: papel e Esc) | P1 |
| IMP-06 | Selects da importação sem nome acessível | `[… IMP-06]` | P2 |
| A-10 | Erro da importação não anunciado (`role=alert`) | `[… A-10]` | P2 |
| CFG-06 | Campos de Configurações sem nome (nome do pipeline, da tag, da etapa) | `[… CFG-06]` | P2 |
| CFG-07 | Formulário de template sem rótulos | `[… CFG-07]` | P2 |
| A-05 | `--faint` abaixo de 4,5:1 (≈ 3,46 escuro / 2,94 claro) | `[… A-05]` | P3 |
| SYS-02 | Acento verde do tema claro como texto (≈ 3,22:1) | `[… SYS-02]` | P2 |
| IMP-02 | Lote > 2.000 linhas falha inteiro (a tela não avisa) | `leadImportModal` (2.001/10.000 enviados em 1 chamada); `test_ux_safety_net` (422, nada gravado) | P1 |
| IMP-03 | Origem desconhecida e linhas sem nome descartadas em silêncio | `leadImportModal` (caracterização) | P1 |
| IMP-07 | Motivo das linhas ignoradas não é exibido | `leadImportModal` (caracterização) | P2 |
| IMP-05 | Duas colunas no mesmo campo: a última vence; sem Nome, botão desabilitado sem explicação | `leadImportModal` (caracterização) | P2 |
| PIP-02 | Ordenação só sobre itens carregados | `pipelinePage` `ordenação é APLICADA NO CLIENTE…` | P1 |
| PIP-07 | Período = criação; presets calculados uma vez | `sharedComponents` (relógio falso); `test_ux_safety_net::…creation_date` | P2 |
| PIP-17 | `%` age como curinga; telefone formatado não casa | `test_ux_safety_net::…wildcards…` | P3 |
| DRW-05 | Timeline pedida sem limite (máx. 100) | `leadDrawer` + `test_ux_safety_net::…100_items…` | P2 |
| DRW-04 | Probabilidade fora de 0–100 ajustada em silêncio | `leadDrawer` | P2 |
| PIP-09 / D-03 | Ganho/Perdido sem confirmação | `pipelinePage`, `leadDrawer` | P2 |
| CFG-02 | Tag e template excluídos sem confirmação | `settingsPage` (2) | P1 |
| CFG-03 | Excluir etapa apaga templates sem aviso | `settingsPage` + `test_ux_safety_net::…also_deletes_its_message_templates` | P2 |
| CFG-05 | Criar etapa sem Ganho/Perdido | `settingsPage` | P2 |
| BE-01 / D-01 | `last_interaction_at` só muda ao mover | `test_ux_safety_net::…only_changes_when_the_lead_is_moved_today` | P2 |

## FALHA NOVA (3 testes `it.fails`)

| ID | Falha | Evidência |
|---|---|---|
| **N-01** | Os dois campos de data do filtro de período não têm nome acessível (`PeriodFilter.tsx`, `input[type=date]` sem `aria-label`) — afeta Pipeline, Leads e Dashboard | `a11yBaseline` `[FALHA NOVA N-01]` |
| **N-02** | O seletor de arquivo da importação não tem nome acessível | `[… N-02]` |
| **N-03** | Sem coluna "Nome" mapeada, "Importar" fica desabilitado **sem dizer por quê** (já listado como parte de IMP-05; aqui como teste de acessibilidade/UX próprio) | `[… N-03]` |

## ERRATA da Auditoria 01

| Onde | Afirmação | O que os testes provaram |
|---|---|---|
| `05_AUDITORIA_IMPORTACAO_CSV.md` IMP-08 | Em "atualizar", "telefone, WhatsApp, origem, … **não** são sobrescritos" | **Telefone e WhatsApp SÃO gravados** quando a linha os traz (`use_cases.py` — `changes["phone"]`, `["whatsapp"]`, `["phone_normalized"]`). Não são atualizados: origem, classificação de aquisição, fonte, site e documento. Teste: `test_update_replaces_phone_when_the_row_brings_a_different_format`. O documento original da auditoria **não foi alterado** (é a fonte congelada); esta errata o corrige. |

## MANUAL (não automatizável aqui)

Leitor de tela (NVDA/VoiceOver) nos quatro fluxos · zoom 200 %/400 % · alvos de toque (botões WhatsApp/E-mail ≈ 22 px < 24 px) · `@media` do seletor "mover" (oculto no desktop com mouse) · ordem de foco com muitas colunas · arrastar com toque/caneta/voz · contraste de selos translúcidos · alternância visual de tema.

## Riscos de regressão que **ainda** existem

1. O arrastar HTML5 é testado com eventos sintéticos do jsdom; o comportamento real do navegador (soltar entre colunas, rolagem) é MANUAL.
2. O CSS não é avaliado (CSS Modules sem estilos no jsdom): quebras de layout/overflow não são detectadas.
3. A importação com **volumes reais** (milhares de linhas no navegador) não foi medida (parse síncrono — IMP-10).
4. Concorrência entre duas importações simultâneas com o mesmo telefone (sem índice único) não foi testada.
5. Componentes de Automações/Notificações/Integrações/Prospecção não ganharam testes novos (FORA do escopo).
