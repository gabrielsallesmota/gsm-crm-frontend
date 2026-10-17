# 13 — Handoff: condições de entrada para o redesign do Pipeline

## Estado

- **1B commitada** (commits exclusivos, só locais): backend `0977b50`, frontend `f032d65` — ver `11`.
- **Estabilização** na branch `test/gsm-crm-phase-1b-stabilization` (os dois repositórios), **não commitada**, aguardando sua revisão.
- Gate para liberar o redesign: revisar/autorizar os commits (1B já feita; estabilização pendente) e decidir os itens de `12`.

## O que o redesign pode assumir como garantido (com teste)

1. **Ordenação do quadro é global e do servidor** (sem desempate instável); mudar ordenação/filtro descarta respostas antigas.
2. **Importação** é segura contra reenvio, corrida entre importações, linha venenosa, queda de rede e reinício do backend; retomada só dentro de 20 h. O motor é `utils/leadImport.ts` (puro); a tela pode mudar livremente.
3. **Acessibilidade do Pipeline** em navegador real: foco visível, Tab cartão → seletor → contatos, botões de etapa por teclado, alvos de 24/44 px, diálogo de importação com foco preso/devolvido.
4. **Isolamento multi-tenant e papéis** com testes de backend e navegador.

## Rede de segurança para o redesign

- `npm run e2e` (≈ 20 min; Chromium completo + `@cross` em Firefox/WebKit) — **rode antes e depois de cada fase visual**. Capturas em `e2e/.artifacts/screenshots` servem de linha de base (não de oráculo).
- Seletores de E2E usam papéis/rótulos acessíveis e algumas classes de CSS Module (`columnLabel`, `columnCount`, `summaryStats`, `columnHeader`): **se o redesign renomear essas classes, atualize `e2e/support/app.ts`**, não os testes.
- Contratos de texto verificados pelos testes: "Carregar mais (N)", "Abrir <nome>", "Mover <nome> para outra etapa", "Mover etapa <X> para a esquerda/direita", "Importar planilha", estados "Concluído / Concluído com erros / Falhou / Cancelada", "Retomar importação", "Preparar nova importação".

## O que o redesign deve tratar (achados, não bloqueios)

P1 overflow do filtro de período no WebKit mobile · P2 contraste do botão WhatsApp no claro · P3 limites nos esquemas de criar/editar lead · P5 leitor de tela real.

## Dependências ainda não liberadas (nada foi implementado)

D-01 (última interação), D-02/06/07/08/09/11/12/13. `last_interaction_at` mantém a semântica.

## Como rodar localmente (resumo)

```
cd gsm-crm-frontend
npm run e2e:install        # uma vez: baixa Chromium/Firefox/WebKit
npm run e2e                # sobe API (porta 8110) + Vite (5174), semeia, roda e derruba
E2E_REUSE=1 npm run e2e -- --project=chromium -g "importação"   # com servidores já em pé
E2E_REUSE=1 E2E_ALLOW_RESTART=1 npx playwright test e2e/restart.spec.ts --project=chromium
```

Requer o Postgres/Redis do `docker-compose` do backend em `localhost`. O banco usado é **`gsm_crm_e2e`** (recriado a cada execução); a senha dos usuários de teste é gerada na execução e nunca fica em arquivo.
