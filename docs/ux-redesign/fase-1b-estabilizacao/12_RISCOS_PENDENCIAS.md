# 12 — Riscos residuais, pendências e decisões

## Situação dos riscos da 1B (R1–R9)

| Risco | Situação | Como |
|---|---|---|
| **R1** corrida entre importações | **RESOLVIDO** | lock consultivo transacional por tenant + releitura da idempotência (`05`); 10 testes de backend + 4 E2E; reprodução do defeito antes do lock |
| **R2** relatório só na sessão | **MITIGADO, não eliminado** | replay reconstrói o relatório dentro da janela (E2E: recarregar + mesma planilha → lote 1 = replay). Não há histórico permanente (exigiria tabela nova: **decisão pendente**) |
| **R3** assinatura muda com arquivo/parâmetros | **VERIFICADO** | testes: outro arquivo, estratégia, mapeamento, usuário e tenant geram outra importação (sem reaproveitar) |
| **R4** retomada vs TTL 24 h | **RESOLVIDO** | janela de 20 h **fixa a partir do início**, bloqueio com aviso, recuperação sem "duplicar" (`06`) |
| **R5** posição otimista do card | **CARACTERIZADO** | E2E: o card aparece na etapa de destino de imediato; após recarregar, a posição é a do servidor. Aceito |
| **R6** validação de e-mail/telefone | **PARCIAL** | **novo:** limites de tamanho agora são validados por linha (servidor e navegador). Formato de e-mail/telefone continua decisão do servidor (só avisa telefone curto) |
| **R7** prospects com outro endpoint | **ABERTO** | `ProspectImportModal` só recebeu a11y; não usa lotes/idempotência. Decisão: replicar o motor ou não |
| **R8** campos da Prospecção interna | **ABERTO** | `ProspectDrawer` (18 campos) não medido campo a campo |
| **R9** jsdom não prova CSS/foco/layout | **RESOLVIDO para o escopo** | E2E em Chromium/Firefox/WebKit com axe; achou o foco do seletor "mover" e o overflow do WebKit |

## Pendências (nenhuma bloqueia o redesign do Pipeline)

| # | Pendência | Gravidade |
|---|---|---|
| P1 | **WebKit/iOS 390 px**: filtro de período faz a página rolar ~65 px na horizontal (achado A) | média — corrigir no redesign do Pipeline |
| P2 | Contraste do botão **WhatsApp no tema claro** (axe *serious*, 29 elementos) | média |
| P3 | Criar/editar lead **manualmente** com campo acima do limite devolve **500** (mesma causa da linha venenosa, outro endpoint; basta `max_length` nos esquemas) | média |
| P4 | Reconhecer "UF"/"Estado" no de/para automático | baixa |
| P5 | **Leitor de tela real** (NVDA/VoiceOver) nunca foi executado | média |
| P6 | Importação de 10.000+ em **homologação** (só ambiente local isolado) | média |
| P7 | Criar lead manual **durante** uma importação não é serializado (formulário manual não deduplica por telefone) | baixa |
| P8 | Janela de retomada depende do relógio do aparelho | baixa |
| P9 | Doc `fase-1b/06` diz "12 todo" no Vitest; o número correto é 19 (7 `todo` de a11y + 12 planejados) — correção só de texto | baixa |

## Decisões que precisam de você

1. **Histórico permanente de importações** (tabela nova + migration) — só se "relatório depois de fechar a página" for requisito. Hoje: não criado.
2. **Índice único parcial em telefone?** Não recomendado (proíbe "criar duplicado", que é intencional). O lock resolve o caso sem migration.
3. **Mesmo motor de lotes para a importação de prospects (R7)?**
4. **Autorizar o commit** da estabilização (ver `11`; nada foi commitado, como pedido).
5. Corrigir P1–P3 agora (pequenos) ou levar para o redesign.

## Restrições respeitadas

Nenhuma migration; nenhum dado de produção; ambiente isolado `gsm_crm_e2e` (a API **recusa** subir noutro banco); sem push, merge nem deploy; `package.json`/`package-lock.json` só ganharam as 2 devDependencies de teste.
