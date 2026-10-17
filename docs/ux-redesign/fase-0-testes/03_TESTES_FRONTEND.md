# 03 — Testes de frontend (Fase 0)

Ferramentas: as já existentes — **Vitest + Testing Library + jsdom** (componentes) e **`node --test`** (utilitários). **Nenhuma dependência nova**: `user-event`, MSW e axe **não** foram adicionados (os eventos usam `fireEvent`; os serviços são substituídos com `vi.mock`, o mesmo padrão dos testes de Notificações/Automações). Nenhum componente de produção foi tocado.

## Arquivos criados (12 de teste/apoio) e modificado (1 de configuração)

| Arquivo | Tipo | Testes | Cobre |
|---|---|---|---|
| `tests/ui/support/harness.tsx` | apoio | — | fixtures (`makeLead`, `makePipeline`, `makeTask`…), papéis (`ADMIN`, `GESTOR`, `VENDEDOR`, `STAFF`, `SUPPORT_READ_ONLY`), `renderApp` com Auth + Toast + Router, `deferred()` para respostas fora de ordem, `rerenderAs` para troca de tenant; invalida o cache de leituras compartilhadas a cada render |
| `tests/ui/support/setup.ts` | apoio | — | `asyncUtilTimeout` de 4 s (evita falso negativo sob carga) |
| `tests/ui/pipelinePage.spec.tsx` | componente | **43** | F-01..F-13: carregamento, vazio, erro, troca de pipeline/tenant, ordem de respostas, paginação, mover (otimista/rollback/concorrente/mesma etapa/ganho/perdido), reordenar por papel, filtros, ordenação, cartão, importar/exportar |
| `tests/ui/leadDrawer.spec.tsx` | componente | **44** | F-13..F-22: abrir/fechar, proteção de rascunho, foco, edição/salvamento/erro, etapa e responsável, tarefas, comentários, timeline, exclusão (cancelar/confirmar/erro/empilhado), WhatsApp (precedência, placeholders, sem template), e-mail, sessão de suporte |
| `tests/ui/leadImportModal.spec.tsx` | componente | **34** | F-10: arquivo (vazio, `;`, UTF-8, Windows-1252), mapeamento (auto/manual/duplicado/sem Nome), descartes, duplicados (3 estratégias), papéis, volumes 1/500/2.000/2.001/10.000, processamento, resumo, erros, fechar pelo fundo |
| `tests/csvParser.test.ts` | Node | **19** | `parseCsv` e `readFileAsText` (separadores, aspas, BOM, CRLF, linhas em branco, codificações) |
| `tests/ui/settingsPage.spec.tsx` | componente | **38** | F-24..F-31: pipelines, etapas, tags, origens, templates, navegação, áreas internas |
| `tests/ui/sharedComponents.spec.tsx` | componente | **20** | `Modal`/`useDialog`, `ConfirmDialog`, toasts, `PeriodFilter`, modo demo × API |
| `tests/ui/routeGuards.spec.tsx` | componente | **35** | mapa de guards por rota (21 rotas), decisão por papel/feature/sessão de suporte, guards renderizados |
| `tests/ui/leadsPageLinks.spec.tsx` | componente | **6** | `?novo=1`, estados vazios, erro |
| `tests/ui/a11yBaseline.spec.tsx` | componente | **23 + 7 todo** | linha de base de acessibilidade (ver abaixo) |
| `tests/ui/plannedFuturePhases.spec.tsx` | planejado | **19 todo** | cenários futuros (`it.todo`) |
| `vitest.config.ts` (modificado) | configuração | — | `setupFiles` e `testTimeout: 20000` |

**Total frontend novo: 262 testes executados** (243 Vitest + 19 Node) **+ 26 `todo`** (7 manuais + 19 planejados).

## Estratégia

- **Caracterização, não correção**: cada teste descreve o que a tela faz hoje; limitações aparecem como "(caracterização — ID)" no nome, para que a Fase 1 saiba exatamente qual teste mudar.
- **Mocks na fronteira de serviço** (`pipelinesService`, `leadsService`, `usersService`…), nunca dentro dos componentes: hooks, estado, debounce, cache compartilhado e renderização rodam de verdade.
- **Cache de leituras compartilhadas**: `renderApp` chama `invalidateShared()`; sem isso, um teste enxergaria os pipelines do anterior.
- **Respostas fora de ordem** testadas com promessa controlada (`deferred`), sem `setTimeout` arbitrário.
- **Sem snapshots**.

## Linha de base de acessibilidade (a11yBaseline)

| Classe | Qtde | Como aparece |
|---|---|---|
| **PASSA** | 9 | testes comuns (verde = comportamento correto hoje) |
| **FALHA CONHECIDA** | 11 | `it.fails` — verde enquanto o defeito existe; **passa a falhar quando for corrigido**, sinalizando a hora de convertê-lo em teste comum |
| **FALHA NOVA** | 3 | `it.fails` — defeitos não listados na Auditoria 01 (N-01..N-03) |
| **MANUAL** | 7 | `it.todo` |

As 14 `it.fails` foram **validadas uma a uma** (cópia temporária com `it` normal): cada uma falha por assertiva do defeito pretendido, não por erro de seletor. Detalhe em `06_FALHAS_CONHECIDAS.md`.

## Cenários que exigiram cuidado

- Cartão com `role="button"` contém `<select>` e `<a>`: o clique em "Mover"/"E-mail" **não** abre o painel (`stopPropagation`) — testado; a semântica aninhada é falha conhecida (PIP-01).
- Dois diálogos empilhados (painel + confirmação): Esc fecha só o do topo — testado com abertura sequencial (o inverso, aninhar um `Modal` dentro de outro, não representa o uso real).
- `PeriodFilter` calcula os presets ao importar o módulo: teste com `vi.resetModules` + relógio falso comprova que "Hoje" não se atualiza com a aba aberta.
- Contraste: calculado dos tokens reais de `theme.css` (não de constantes copiadas).

## Como rodar

```
npm run test:unit          # node --test (inclui csvParser)
npm run test:ui            # vitest (jsdom)
npx vitest run tests/ui/pipelinePage.spec.tsx   # um arquivo
```
