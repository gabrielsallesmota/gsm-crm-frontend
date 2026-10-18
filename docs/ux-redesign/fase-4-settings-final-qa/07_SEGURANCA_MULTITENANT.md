# 07 — Segurança, RBAC e isolamento multi-tenant

Tudo em **ambiente isolado** (`gsm_crm_e2e` / `gsm_crm_test` locais), **dados fictícios**, sem credenciais de produção. Esta fase **não alterou** o modelo de permissões nem políticas de segurança.

## O que foi verificado (e como)

| Área | Verificação | Evidência |
|---|---|---|
| **Isolamento entre tenants (leads)** | cada tenant vê só os próprios leads, mesmo com nomes e telefones iguais; lead de outro tenant não é lido/alterado/movido/apagado (404) | E2E `security.spec.ts` (3 navegadores no caso @cross) |
| **Isolamento (configurações)** — *novo* | admin do tenant A **não** altera pipeline do tenant B (`PATCH` → 403/404), **não** remove tag do tenant B e **não** lista a tag do tenant B | E2E `settings.spec.ts › vendedor não acessa… IDOR` |
| **RBAC das configurações** — *novo* | vendedor recebe 401/403 em `POST /pipelines`, `POST /tags`, `PATCH /pipelines/{id}`; gestor consegue (`settings.manage` = ADMIN+GESTOR); UI: item "Configurações" ausente e rota não renderiza a página | idem |
| **RBAC dos leads** | vendedor vê só os próprios; admin/gestor todos; vendedor não importa para outro responsável nem vê nome de lead alheio com mesmo telefone | `security.spec.ts` |
| **Importação** | pipeline/etapa/responsável de outro tenant recusado, nada gravado; mesma `Idempotency-Key` em outro tenant/usuário **nunca** devolve resposta alheia | `security.spec.ts` + pytest `test_import_security_stabilization.py` |
| **Sessão/ autenticação** | sem sessão: rota redireciona e API recusa; limites de login; troca de senha forçada | `security.spec.ts`, pytest `test_login_security.py`, `test_stage0_security.py` |
| **Backend multi-tenant/RLS** | catálogo de RLS, isolamento por tenant, papéis, impersonação (suporte) e chaves de API | pytest `test_rls_catalog.py`, `test_tenant_isolation.py`, `test_rbac.py`, `test_impersonation*.py`, `test_api_key*`, `test_platform*` — **na suíte completa verde** (ver `01`) |
| **Validação de entrada** | campos acima do limite → 422 legível (nunca 500); `Idempotency-Key` e linhas "venenosas" na importação | `security.spec.ts`, pytest `test_lead_field_limits_stabilization.py` |
| **Acesso a configurações internas** | área "Prospecção (GSM)" só para `platform.internal`: o botão não existe e `?secao=interno` cai no padrão; as chamadas internas (ex.: IA dos textos) **nem são feitas** para cliente comum | Vitest "?secao=interno para cliente comum…", E2E "área interna só para staff" |
| **Feature flags** | atalhos de Automações/Notificações/Integrações só com a feature contratada **e** a permissão | Vitest F-29..F-31 |
| **Ações destrutivas** | confirmação em exclusão de pipeline/etapa/tag/template/lead e (D-03) ao marcar como perdido; sessão de suporte barra exclusões no **backend** (`forbid_impersonation`) | UI + E2E; pytest impersonação |
| **Concorrência / idempotência** | importação simultânea serializada (lock por tenant), janela de retomada, middleware de commit com 6 clientes × 20 rodadas | pytest + E2E (`import.spec.ts`), `test_read_after_write_visibility.py` |
| **Dados pessoais em logs** | revisão do `RequestLoggingMiddleware`: loga **método, path (sem query), status, duração e request_id** — nunca corpo, cabeçalhos, e-mail ou telefone. O E2E não envia e-mail (`RESEND_API_KEY` vazio) nem mensagens reais | leitura do código; limite: não auditei **todos** os `logger.*` do projeto |

## Confirmação de UX ≠ autorização

O diálogo de "perdido" e a ocultação de botões são **conforto de interface**. A autoridade continua no backend (papel, tenant/RLS, `forbid_impersonation`, recusas 403/404/409). Os testes acima chamam a API **diretamente** com o token de cada papel/tenant exatamente para provar isso.

## Não verificado / limitações

- **Pentest** real, fuzzing e varredura de dependências (SCA/SAST) **não** foram executados.
- **Rate limiting** em produção (Traefik/Redis) só foi exercitado com os limites de teste folgados.
- **Sessões de suporte (impersonação)** foram cobertas pelos testes de backend existentes; **não** houve novo teste E2E de impersonação nesta fase.
- Revisão de logs foi **pontual** (middleware de requisição), não varredura total.
- Segredos: nenhum foi versionado nesta fase (senhas E2E são geradas por execução).

## Classificação

Nenhum achado **P0/P1** de segurança. O único ponto relacionado a UX/segurança é **P2**: o assistente de importação aceita escolher uma etapa de entrada **de perda** (os leads entram como perdidos); a tela agora **avisa**, mas não exige confirmação (decisão de produto pendente).
