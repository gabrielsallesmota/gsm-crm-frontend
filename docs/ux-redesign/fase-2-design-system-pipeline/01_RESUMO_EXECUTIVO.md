# 01 — Resumo executivo: Design System + redesign do Pipeline (Prompt 06)

**Resultado:** Pipeline redesenhado e **pronto para revisão**, sem funcionalidade removida, com Design System aplicado, mobile utilizável, overflow do WebKit e contraste do WhatsApp corrigidos e o erro HTTP 500 resolvido. **Redesign sem commit** (como pedido); estabilização commitada.

## Gate Zero

| Item | Resultado |
|---|---|
| Git na entrada | branches e hashes documentados **conferidos**: backend `0977b50`, frontend `f032d65` presentes; árvore só com a estabilização do Prompt 05 |
| **HTTP 500 em campo longo** | **causa real**: os esquemas de criar/editar lead não tinham `max_length` (a API pública tinha); valor acima da coluna estourava no banco (`StringDataRightTruncation`). Telefone com dígitos demais estourava `phone_normalized`. **Correção na camada certa**: limites no Pydantic (422 com campo e limite) + validação de domínio do telefone. Sem truncar, sem migration, sem mudar limite de negócio. |
| Testes da correção | backend 17 · frontend Node 9 · UI 1 · E2E (API real) 1 — todos verdes |
| Consolidação | pytest **2.739 passam**, lint/tipos limpos; teste instável pré-existente (relógio) corrigido |
| **Commits da estabilização** | backend **`e8cda1c`**, frontend **`b28e119`** (locais; sem push/merge/deploy) |
| Branch do redesign | `feat/gsm-crm-redesign-pipeline` (frontend) |

## O que mudou no Pipeline

- **Cabeçalho**: nome do pipeline, resumo real ("24 oportunidades · 19 em andamento (R$ 58.800)"), ação primária "Novo lead".
- **Filtros**: busca/responsável/ordenação à vista; período em "Filtros" (disclosure) rotulado **"Criados em"**; filtros ativos em **chips removíveis**.
- **Colunas**: totais reais; soma de valores **só quando exata**; rolagem própria; estados vazio/carregando/erro; destino do arraste realçado.
- **Cartões**: nome em destaque, valor só se > 0, origem + idade, responsável com avatar, **ícones** de WhatsApp/e-mail, "Sem responsável" como atenção; sem aninhar interativos.
- **Celular**: **uma etapa por vez** (abas com total real); nenhuma função removida.
- **Design System**: tokens de espaçamento, tipografia (piso 12 px), raios, camadas, movimento, superfícies, estados; 11 ícones; chip de filtro; breakpoints documentados.

## Evidências (de verdade)

- **E2E Playwright 164 testes** em Chromium/Firefox/WebKit: **163 passam** + o de reinício do backend (manual, passou); a única falha da rodada completa foi um teste de Tab no WebKit (links fora da ordem de Tab por padrão no Safari) — corrigido e reexecutado nos 3 navegadores.
- **axe-core: 0 violações** em 32 auditorias (4 resoluções × 2 temas), incluindo contraste.
- Frontend: **449** testes de UI + **284** unitários; eslint, tsc e build limpos; JS principal **+13,5 kB (+3,5 %)**.
- 15 capturas reais em `evidencias/` (`09`).

## Defeitos que só o navegador real mostrou (corrigidos)
Arraste nativo que **parou de soltar** (realce inserido no fluxo), página alargada em 768 px por texto oculto, foco do seletor "mover" sem contorno, sombra do menu vazando no celular.

## Pendências principais (`10`)
Leitor de tela real não executado · arrastar por toque (usa o seletor) · soma por etapa exata e sinais de atenção dependem do backend e de D-01/D-09 · filtros não persistem na URL · suspeita de leitura logo após escrita no backend (commit depois da resposta) **não alterada**.

**Próximo passo:** revisar e autorizar o commit do redesign; decidir os itens de `10`; então o Prompt 07 (drawer).
