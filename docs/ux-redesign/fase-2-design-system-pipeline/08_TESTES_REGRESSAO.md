# 08 — Testes e regressão

## Resultado final (2026-10-18, ambiente local isolado)

| Verificação | Resultado |
|---|---|
| **Backend** `pytest` (suíte completa, Postgres real) — Gate Zero | **2.739 passam, 7 ignorados, 0 falhas** (+17 desta fase: limites de campo) |
| Backend `ruff` / `black --check` / `mypy app` | limpos |
| Frontend `eslint .` (inclui `e2e/`) | **limpo** |
| Frontend `tsc -b` (inclui `tsconfig.e2e.json`) | **limpo** |
| Frontend Node (`npm run test:unit`) | **284 passam** (antes 273: +11 de `pipelineView`) |
| Frontend Vitest | **449 passam, 19 `todo`** (antes 423: +25 `pipelineRedesign`, +1 CSS do arraste) |
| Frontend `npm run build` | **ok** — `index` JS 393,5 kB (gzip 121,6) vs 380,1 kB (117,2) antes: **+13,5 kB (+3,5 %)** pelo código novo (ícones, filtros, coluna, cartão); nenhuma dependência de produção nova |
| **E2E Playwright** (164 testes) | Chromium **112** (111 passam + `restart` manual, executado à parte e **passou**) · Firefox **26/26** · WebKit **26/26** (um teste de Tab no WebKit foi ajustado — ver abaixo) |
| **axe-core** | 32 auditorias (Pipeline + 3 estados da importação × 4 resoluções × 2 temas): **0 violações** (inclui `color-contrast`) |

> Rodada completa de E2E: **162 passam + 1 falha (WebKit, ordem de Tab) + 1 manual**. A falha era do **teste**, não do app: o WebKit/Safari não inclui links na ordem de Tab por padrão. O teste agora espera "resumo → seletor" no WebKit e "resumo → WhatsApp → e-mail → seletor" nos demais; reexecutado nos 3 navegadores: verde. As demais 162 não foram reexecutadas após esse ajuste de teste (nenhum código do app mudou entre elas).

## Gate Zero (HTTP 500)

| Camada | Teste | Resultado |
|---|---|---|
| Backend | `test_lead_field_limits_stabilization.py` — 17 testes: criar/editar com 7 campos acima do limite → **422** com campo e limite; limite exato aceito e **gravado inteiro** (sem truncar); telefone com dígitos demais → 422; API pública também | verdes |
| Frontend (Node) | `apiErrors.test.ts` — "Empresa: pode ter no máximo 200 caracteres" etc. (rótulo "Cargo" incluído); 422 de domínio mostrado como veio; nenhum 422 como "erro inesperado" | verdes |
| Frontend (UI) | `leadDrawer.spec.tsx` — drawer mostra a mensagem legível e **preserva o rascunho** | verde |
| E2E (API real) | `security.spec.ts` "limites de campo" — 6 campos × criar/editar → 422, limite exato → 201, nada alterado | verde |

## Matriz de preservação funcional (nada foi removido)

| Função | Como continua testada |
|---|---|
| Carregar quadro, 25/página, "Carregar mais", total real | `pipelinePage.spec` (inalterado) + E2E (60 e 170 leads) |
| Ordenação global e paginação sem repetir/pular | `pipelinePage.spec` + E2E (A-Z/Z-A/data/empates/resposta atrasada) |
| Filtros (busca, responsável, período, ordenação) | `pipelinePage.spec` (período agora via "Filtros") + `pipelineRedesign` (chips) + E2E |
| Arrastar card entre etapas (otimista, rollback, "busy") | `pipelinePage.spec` + `pipelineRedesign` (estados/cancelar) + **E2E nativo nos 3 navegadores** |
| Reordenar etapas (arrastar e botões), permissões | `pipelinePage.spec` + `phase1bPipelineA11y` + E2E |
| Mover por seletor / teclado, foco preservado | `pipelinePage.spec` + E2E (Chromium: ArrowDown; demais: `selectOption`) |
| Abrir drawer (clique/Enter/Espaço) | `pipelinePage.spec` + E2E |
| Criar lead ("Novo lead"), importar, exportar | `pipelineRedesign` + E2E |
| Importação CSV (volumes, falhas, retomada, concorrência) | **intocada**: `import.spec.ts` (33 testes) verde |
| WhatsApp/e-mail do cartão | `pipelineRedesign` + `guardsAndWhatsapp.spec` + E2E |
| Permissões (vendedor sem responsável/reordenar), multi-tenant | `pipelineRedesign` + `security.spec` + backend |
| Mobile: nenhuma função some | `pipelineRedesign` + `redesign.spec` (390 px) |

## Testes de caracterização alterados DE PROPÓSITO (razão)

| Teste | Mudança | Razão |
|---|---|---|
| `pipelinePage.spec` período (2) | abrem "Filtros" antes | o período agora fica no painel (progressive disclosure) |
| `pipelinePage.spec` "não rotula 'criados em'" | passou a **exigir** "Criados em" + chip | rótulo da regra D-02 |
| `pipelinePage.spec` cartão (3) | consulta o contêiner do cartão (resumo + rodapé) e "R$ 2.500" exato | dono/contatos agora estão no rodapé, irmão do botão |
| `phase1bPipelineA11y` varredura de CSS (3) | apontam para `LeadCard.module.css`/`KanbanColumn.module.css` | CSS do cartão/coluna mudou de arquivo |
| E2E helpers | `data-stage-*` no lugar de `class*=` | seletores robustos |
| E2E Tab do cartão | nova ordem do DOM; WebKit sem links | acima |

## Defeitos que só o E2E em navegador real pegou
Arraste nativo deixando de soltar (realce inserido no fluxo), 93 px de overflow em 768 px (`.sr-only` fora do recorte), foco do seletor "mover" sem contorno, sombra do menu vazando no celular — detalhes em `10`.
