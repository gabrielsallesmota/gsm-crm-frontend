# 01 — Resumo executivo: painel do lead + assistente de importação CSV (Prompt 07)

**Resultado:** painel do lead redesenhado, assistente de CSV em 5 etapas, **404 intermitente investigado, causa medida e corrigida**, sem funcionalidade removida e sem mudança no mecanismo de importação.

## Gate Zero

| Item | Resultado |
|---|---|
| Hashes da estabilização | backend `e8cda1c`, frontend `b28e119` — presentes |
| Commit do Prompt 06 | **já existia**: redesign do Pipeline commitado como `add6eb5` (frontend `main`) antes desta fase, por pedido do usuário; backend `8fbad84` (correção de teste de fuso) |
| Árvore | limpa nos dois repositórios |
| Lint/tipos/build · UI 449 · Node 284 | verdes |
| E2E críticos do Pipeline (chromium) | 34/34 |
| HTTP 500 em campo longo | corrigido na estabilização (422 legível) — coberto pela suíte |

## O que mudou

- **Painel do lead** (`02`, `04`): cabeçalho com ações rápidas, Resumo comercial, Contato à vista, Próxima ação em destaque, timeline com tipos visuais e "Ver mais" (contrato `?limit=` existente), formulário agrupado com validação por campo e proteção contra perda; D-03 (confirmar "perdido") aplicado no painel.
- **Assistente de CSV** (`05`, `06`): Arquivo → Colunas → Revisão → Importação → Resultado; modal largo / tela cheia no celular; interromper com confirmação; orientação de retomada; relatório sempre disponível; progresso real.
- **404** (`03`): resposta saía **antes do commit**; middleware ASGI garante commit → resposta. Backend em branch própria.
- **Design System** (`07`): só tokens existentes; `Modal size="wide"`.

## Evidências

- UI 458 · Node 288 · build ok (+5 % de JS) · ESLint/tsc limpos.
- E2E 3 navegadores: **192 passam**, 1 intermitente de login (passa isolado), 1 manual ignorado.
- axe: **0 violações** em 16 auditorias (4 resoluções × 2 temas); 1 defeito de contraste achado e corrigido.
- 13 capturas reais (`11`).
- Backend: suíte completa verde; 7 testes novos.

## Decisões preservadas

D-01 (`last_interaction_at` intocado e nenhum indicador inventado), D-03 (confirmar perdido; sem motivo obrigatório), D-04, D-05, D-10 (10.000 linhas, lotes de 500, idempotência, retomada, relatório, duplicados, multi-tenant). D-07 **não** implementada (sem edição inline).

## Pendências principais (`12`)

Leitor de tela real não executado · D-03 ainda não estendido ao Pipeline (arraste/"mover") · deploy do middleware altera o momento do envio de **todas** as respostas (observar latência/5xx) · intermitência de login no ambiente E2E.

## Git

Frontend: `feat/gsm-crm-redesign-lead-import`. Backend: `fix/gsm-crm-read-after-write-404`. Por pedido do usuário durante a fase ("sobe os dois pra main quando finalizar"), os dois são publicados na `main` ao final.
