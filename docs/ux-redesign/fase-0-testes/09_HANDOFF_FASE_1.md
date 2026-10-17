# 09 — Handoff para a Fase 1 (correções de integridade e acessibilidade)

## Estado de entrada

- Branches de trabalho: `test/gsm-crm-ux-safety-net` em `gsm-crm-frontend` e em `gsm-crm-backend`, a partir da `main` limpa (frontend `213d52d`, backend `14c2b7d`). **Nada foi commitado, enviado ou implantado.**
- Código de produção **inalterado**; mudanças apenas em testes, apoio de testes, `vitest.config.ts` e documentação.
- Rede de segurança: ver `08_RELATORIO_EXECUCAO.md` para os números e `02_MATRIZ_COBERTURA.md` para o mapa F-01..F-38.

## Condições para iniciar a Fase 1

| # | Condição | Situação |
|---|---|---|
| 1 | Suítes verdes (frontend: lint, tipos, 239 Node + Vitest; build; backend completo) | ver 08 |
| 2 | Revisão e **commit autorizado** do diff desta fase (testes e docs) | **pendente — aguarda autorização** |
| 3 | Decisões D-02, D-06, D-07, D-08, D-09, D-11, D-12, D-13 confirmadas **ou** a Fase 1 limitada ao que não depende delas | pendente (recomendadas, não bloqueiam a Fase 1) |
| 4 | Aprovação de que a Fase 1 pode adicionar dependência de dev (ex.: `user-event`/axe) se necessário | pendente (não era necessário até aqui) |
| 5 | Revisão da **errata** IMP-08 (06) e da correção de rotulagem do "atualizar" | pendente |

## Escopo recomendado da Fase 1 (itens sem decisão de produto pendente)

Cada item tem **o teste que prova a correção**; a Fase 1 só termina quando todos passam.

| Item | Correção | Teste de aceite |
|---|---|---|
| IMP-02/IMP-03/IMP-04 | validar e avisar o limite; relatório de pré-importação (válidas / avisos / descartadas) | alterar `leadImportModal` (volumes 2.001/10.000 e descartes silenciosos) |
| IMP-01 | importação passa a usar `Modal` | converter `[FALHA CONHECIDA IMP-01]` (2) em `it` |
| IMP-06, N-02, A-10 | rótulos e `role="alert"` | converter `IMP-06`, `N-02`, `A-10` |
| DRW-01, CFG-06, CFG-07, N-01 | rótulos programáticos | converter `DRW-01`, `CFG-06`, `CFG-07`, `N-01` |
| CFG-02, CFG-03 | confirmação de exclusão de tag/template e aviso de cascata | trocar os testes "sem confirmação" por testes de diálogo |
| PIP-02 | ordenação no servidor (`sort_by`) | inverter `ordenação é APLICADA NO CLIENTE…` |
| PIP-01 | cartão sem interativo aninhado | converter `PIP-01` |
| A-05 | `--faint` → token com contraste | converter `A-05` |
| IMP-07 | exibir motivo das linhas ignoradas | inverter a asserção de `leadImportModal` |

## Itens que **dependem** de decisão ou de backend (não iniciar sem aprovação)

D-01 (definição de "última interação" — muda comportamento do backend), D-03 (confirmação/motivo de perda), D-05, D-10 (lotes), campos agregados (B-1/B-2).

## Regras para a Fase 1

1. **Primeiro** rodar toda a suíte e confirmar que está verde; qualquer teste de caracterização que passe a falhar deve ser alterado **de propósito**, com a justificativa no PR (é o contrato de mudança).
2. Converter os `it.fails` corrigidos em `it` no mesmo PR; não deixar `it.fails` "passando por outro motivo".
3. Não alterar contrato de API, permissões nem isolamento nesta fase; qualquer mudança funcional vai para a fase própria.
4. Atualizar `02_MATRIZ_COBERTURA.md` a cada PR; itens PARCIAIS devem ganhar teste antes de serem tocados (F-03, F-11, F-16, F-34..F-36).

## Lacunas que impedem avançar com segurança **em itens específicos**

| Lacuna | Impacto | Como fechar |
|---|---|---|
| Sem teste de **layout/responsividade** (CSS não avaliado no jsdom; sem navegador real) | redesign do cartão/cabeçalho/painel pode quebrar visualmente sem alarme | acrescentar verificação visual (Playwright/capturas) **antes** da Fase 2 — requer aprovação de dependência |
| Sem teste de **arrastar real** (HTML5) e de toque | mudança de DnD do quadro (Fase 2) | testes manuais guiados + e2e de navegador |
| Importação com **volume real** no navegador | assistente (Fase 4) | medir parse/envio com 10.000 linhas |
| Corrida entre importações simultâneas (sem índice único em `phone_normalized`) | D-10 | teste de concorrência no backend |
| Onboarding (checklist) e repositórios *mock* da demo não testados | baixo para a Fase 1; relevante se a demo for alterada | testes dedicados |

## Resumo

A Fase 1 **pode começar** nos itens da tabela de escopo, desde que o diff desta fase seja aprovado/commitado e a suíte esteja verde. As fases 2 em diante precisam do reforço visual/e2e acima.
