# 03 — Plano de testes E2E (Playwright)

## Infraestrutura

Não existia E2E no projeto. Foi adicionado **Playwright como dependência de desenvolvimento** (`@playwright/test`, `@axe-core/playwright`), exclusivo para testes; as suítes Node/Vitest/pytest continuam como estavam.

| Item | Decisão |
|---|---|
| Navegadores | Chromium (suíte completa) · Firefox e WebKit (conjunto `@cross`) — os 3 instalados e executados |
| Ambiente | **Isolado**: banco `gsm_crm_e2e` no Postgres local do docker-compose (recriado a cada execução), Redis db 2, API em `127.0.0.1:8110`, Vite em `localhost:5174`. A API **recusa subir** se o banco-alvo não for `gsm_crm_e2e` em `localhost`. Nunca dev nem produção. |
| Dados | `gsm-crm-backend/scripts/e2e_backend.py` cria **300 tenants** independentes (`tNNN-admin/gestor/vendedor@example.com`), pipeline "Comercial" (Novo, Em contato, Ganho, Perdido). Cada teste usa o **seu** tenant (faixas: Chromium 1–100, Firefox 101–200, WebKit 201–300). Fixtures de CSV geradas **em memória**. |
| Credenciais | senha gerada **a cada execução** (`E2E_PASSWORD`, aleatória) e repassada por variável de ambiente; **nada versionado**. E-mail da empresa/clientes: nenhum (`RESEND_API_KEY` vazio). |
| Execução | `npm run e2e` (sobe API + front, semeia, roda e derruba). `E2E_REUSE=1` reaproveita servidores. `E2E_ALLOW_RESTART=1` habilita o teste de reinício do backend. |
| Estabilidade | sem `sleep` fixo (exceções documentadas, uma: provar que uma resposta *atrasada* **não** altera a tela); esperas por estado/resposta; falhas de rede **injetadas** com `page.route`; "progresso real" provado **retendo a resposta** depois que o servidor gravou. |

## Cenários

**Pipeline (`pipeline.spec.ts`, 22):** vazio · poucos leads · >25 por etapa (25/vez, total real, "Carregar mais", sem repetir — ids conferidos nas respostas) · 130+40 leads · troca de pipeline · busca + responsável combinados · ordenação global A-Z/Z-A (60 leads; o 1º em A-Z é o último criado) · por data (lotes com datas distintas) · empates (80 leads com 2 nomes) · mudar a ordenação **no meio da paginação** · resposta antiga **atrasada descartada** · escopo do vendedor · falha da API ao ordenar · mover por arrastar · por seletor · **por teclado** · **rollback** com API 500 · estado ocupado (`aria-busy`) · reordenar etapas por teclado/mouse · permissões · falha da API · posição do card após mover (R5).

**Importação (`import.spec.ts`, 32):** 1, 500, 501, 1.000, 2.000, 2.001, **10.000** e **10.001** (bloqueado) linhas; 5 MB; **progresso real** (resposta retida); cancelar + retomar sem duplicar; recarregar e retomar; retomada vencida; falha no 1º/2º/último lote; timeout depois de gravar; falha antes de gravar; 429/500/409/422; dados mistos (inválidos, UF, telefone repetido no arquivo, quebra de linha, UTF-8 e emoji, origem desconhecida, telefone curto); mapeamento manual; **download do relatório** (BOM, números de linha, fórmulas); fórmulas exportadas; vendedor; **linha venenosa**; **concorrência**: 2 abas, 2 usuários, "duplicar" intencional, 2 tenants.

**Segurança (`security.spec.ts`, 8)** · **Acessibilidade/visual (`a11y-visual.spec.ts`, 24)**: 4 resoluções × 2 temas × (Pipeline, Importação em 3 estados) com axe-core e capturas; teclado/foco; confirmação destrutiva; alvos de toque (emulação de celular e desktop) · **Reinício do backend (`restart.spec.ts`, 1, manual)**.

## Critério "executado"

Só conta como executado o que rodou contra a API real e foi verificado no banco. O que não pôde ser exercitado está em `04` como **NÃO EXECUTADO**.
