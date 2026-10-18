# 14 — Riscos, pendências e gates de release

Classificação conforme o prompt: **P0** bloqueante absoluto · **P1** bloqueante de homologação · **P2** corrigir de preferência antes de publicar · **P3** melhoria futura.

## P0 — nenhum aberto

Sem perda de dados, vazamento entre tenants, falha grave de autorização, duplicação involuntária relevante, corrupção de importação ou operação destrutiva sem proteção **encontrados** nas verificações desta fase (escopo e limites em `07`).

## P1 — bloqueiam a HOMOLOGAÇÃO (dependem de ambiente real/pessoa)

| ID | Pendência | Por que bloqueia | Quem/como resolver |
|---|---|---|---|
| **P1-1** | **Validação com leitor de tela real NÃO executada** (NVDA/VoiceOver) em Pipeline, painel, importação e Configurações | só automação mediu acessibilidade; não se declara conformidade WCAG | pessoa com NVDA (Windows) seguindo o roteiro de `08` |
| **P1-2** | **Versão em produção não verificada** e **efeito do middleware de commit em produção não observado** | o deploy do backend (`4cca3fb`) foi bem-sucedido no CI, mas não consultei o ambiente; o middleware altera o momento do envio de **todas** as respostas | conferir `/health` e versões; observar p95 de latência e taxa de 5xx nas primeiras horas; reverter com `COMMIT_BEFORE_RESPONSE_ENABLED=false` (sem novo deploy de código) |
| **P1-3** | **Homologação humana do redesign já publicado** (Pipeline P06 e painel/CSV P07 foram à `main` sem QA humano prévio, por pedido do usuário) | decisão de publicação antecedeu a revisão | roteiro de aceite em `15` com dados reais de um tenant de homologação |

## P2 — corrigir de preferência antes de publicar

| ID | Item | Situação |
|---|---|---|
| P2-1 | **Playwright não roda no CI** do frontend (só lint, tipos, Vitest, build) | as garantias E2E (D-03 real, RBAC/IDOR, importação, axe) dependem de execução manual; recomendável um job E2E em Linux |
| P2-2 | **Intermitência ambiental de rede** nos E2E em Windows (`ERR_NO_BUFFER_SPACE`, 1 login com "não foi possível conectar") | classificada em `06`; não atribuída à aplicação nem ao middleware (300/300 logins ok); mitigar com CI Linux/ajuste de TCP |
| P2-3 | O assistente de CSV permite escolher uma **etapa de entrada de perda** — os leads entram como perdidos **sem confirmação** | a tela agora **avisa**; confirmar ou restringir é decisão de produto (D-03 + D-10) |
| P2-4 | Logs/métricas medem a latência **sem** o tempo do commit (que agora ocorre antes da resposta) | dashboards de latência subestimam ~1–3 ms por requisição de escrita; medir por fora do middleware se importar |
| P2-5 | Contraste/axe só nas telas redesenhadas; Agenda, Tarefas, Relatórios, Equipe, Dashboard, SDR/Prospecção e Plataforma **sem axe** | auditar antes de abrir para clientes |
| P2-6 | `restart.spec.ts` (reinício real do backend na importação) **não reexecutado** | rodar manualmente (`E2E_ALLOW_RESTART=1`) antes do release |

## P3 — melhorias futuras

| ID | Item |
|---|---|
| P3-1 | Sem proteção de "descartar alterações" nos formulários inline de Configurações (impacto baixo) |
| P3-2 | Excluir estágio de **Prospecção** (interno GSM) sem confirmação (comportamento herdado) |
| P3-3 | Três "dialetos" de formulário (rótulo/erro inline) coexistem; unificar |
| P3-4 | `ProspectImportModal` (staff) mantém o modal estreito e sem etapas |
| P3-5 | Opção estrutural `Depends(..., scope="function")` para o commit (≈ 84 usos) — não necessária hoje |
| P3-6 | Edição inline (D-07), indicadores de "parado há N dias" (D-01/D-09), motivo de perda (não aprovado) |
| P3-7 | Teclado virtual real, zoom 200–400 %, paisagem e dispositivos físicos não testados |
| P3-8 | Uso de *pool* de conexões, CPU e memória do backend com o middleware não medidos |

## Corrigido nesta fase (era pendência ou achado)

D-03 em **todos** os caminhos do quadro · formulário de templates que **apagava o texto** ao recarregar a lista · menu com **dois** itens ativos · contraste do botão `danger` (todos os diálogos de exclusão, tema claro), selo "Padrão", chips de etapa/origem e `<code>` · falha de commit virando **resposta truncada** (agora 500 limpo) · 3 corridas de teste · fontes abaixo do piso nas Configurações.

## Decisões que preciso de você

1. Etapa de entrada **de perda** na importação: apenas avisar (atual), exigir confirmação ou impedir?
2. Publicar o middleware **como está** ou observar primeiro em homologação com `COMMIT_BEFORE_RESPONSE_ENABLED`?
3. Quem executa o **teste com leitor de tela** e em qual ambiente (P1-1)?
4. Criar um job de **E2E no CI** (Linux)?

## Regra de release aplicada

Há **P1 em aberto** (todos dependentes de ambiente real/pessoa, não de código). **Não recomendo publicar para clientes** até P1-1 e P1-3 serem concluídos; P1-2 é uma verificação pós-deploy. P0 não há.
