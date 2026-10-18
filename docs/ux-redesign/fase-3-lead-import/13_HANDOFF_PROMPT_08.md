# 13 — Handoff para o Prompt 08

## Estado de entrada

- Frontend: branch `feat/gsm-crm-redesign-lead-import` (base `add6eb5`, redesign do Pipeline já na `main`).
- Backend: branch `fix/gsm-crm-read-after-write-404` (base `8fbad84`): só o `CommitBeforeResponseMiddleware` + testes.
- Prompt 08 (Configurações e demais telas) **não iniciado**.

## O que reaproveitar

| Recurso | Onde |
|---|---|
| Padrão de painel em seções + componentes por responsabilidade | `components/leads/drawer/*` |
| Formulário agrupado com validação ao lado do campo | `LeadEditForm.tsx` + `utils/leadForm.ts` (regras puras, testáveis em Node) |
| Proteção contra perda ("Descartar alterações?") | `LeadDrawer.tsx` (`requestClose` / `requestCancelEdit`) |
| Assistente em etapas com indicador | `components/leads/import/*` (`ImportStepper` é genérico) |
| Modal largo / tela cheia no celular | `Modal size="wide"` |
| Classes de tipo de evento da timeline | `utils/leadTimeline.ts` (`timelineKind`) |
| Auditoria axe por tela × 4 resoluções × 2 temas | `e2e/a11y-lead-import.spec.ts` (copiar o padrão) |
| Capturas reais | `e2e/visual-evidence-lead-import.spec.ts` |

## Armadilhas aprendidas

1. **jsdom não vê corridas de rede.** O 404 só apareceu com servidor real em TCP e **duas conexões**; numa mesma conexão keep-alive o uvicorn serializa e esconde o problema. Testes de "ler depois de escrever" precisam de `uvicorn` real (ver `test_read_after_write_visibility.py`).
2. **`ASGITransport` espera a aplicação inteira** (inclusive a saída das dependencies): não reproduz nada que dependa da ordem resposta × commit.
3. **Criar `AsyncClient` do httpx a cada chamada** carrega o bundle de certificados e custa ~2 s no Windows — mascara janelas curtas. Pré-criar os clientes.
4. **CSS Modules + `noUncheckedIndexedAccess`**: `styles.x` é `string | undefined`; funções que concatenam classes devem aceitar `undefined`.
5. Arquivos de teste neste repositório usam **CRLF**: edições por script precisam preservar `\r\n`.
6. `useDialog` empilha diálogos: Esc fecha só o do topo (a confirmação, não o painel).
7. Testes que atravessam o assistente: use o helper `inReview()` (UI) ou `chooseFile()` (E2E, já avança até a revisão quando o Nome é reconhecido).
8. O shell desta máquina falha com heredocs grandes e **converte `\\n` em quebra de linha** dentro de scripts embutidos: grave scripts com a ferramenta de escrita, ou use `chr(92)`.

## Como rodar

```
npm run lint && npm run typecheck && npm run test:unit && npx vitest run && npm run build
npm run e2e                                                     # 3 navegadores, ambiente isolado gsm_crm_e2e
npx playwright test e2e/lead-drawer.spec.ts --project=chromium
npx playwright test e2e/a11y-lead-import.spec.ts --project=chromium
npx playwright test e2e/visual-evidence-lead-import.spec.ts --project=chromium   # regenera as capturas
# backend
python -m pytest tests/integration/test_read_after_write_visibility.py tests/unit/test_commit_before_response.py
```

Tenants do E2E nesta fase: drawer 60/120–125 · evidências 126–130 · axe 131–146 (faixas em `e2e/support/env.ts`).

## Fora do escopo desta fase (continua pendente)

Configurações, Agenda, Tarefas, Relatórios e demais telas; importação da Prospecção; confirmação de "perdido" no Pipeline (R2); leitor de tela real (R1).
