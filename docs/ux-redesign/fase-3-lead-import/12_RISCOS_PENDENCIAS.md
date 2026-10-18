# 12 — Riscos e pendências

## Resolvido nesta fase (era pendência do Prompt 06)

| Item | Situação |
|---|---|
| **P6 — 404 em "criar lead e comentar logo em seguida"** | causa **medida** (resposta antes do commit) e **corrigida** no backend (`CommitBeforeResponseMiddleware`), com testes de integração, unitários e E2E sem retentativa. Detalhes em `03` |

## Pendências e riscos residuais

| # | Item | Gravidade | Observação / decisão necessária |
|---|---|---|---|
| R1 | **Leitor de tela real** (NVDA/VoiceOver) não executado. Há axe-core (WCAG 2.2 AA, contraste incluso), árvore de acessibilidade e testes de teclado/foco, mas isso **não** substitui validar com leitor de tela | média | validação manual antes de liberar a clientes |
| R2 | **D-03 só no painel**: mover para "perdido" pede confirmação no drawer; **arrastar/“mover” do cartão no Pipeline e a edição em lote continuam sem confirmação** | média | decisão: estender a confirmação ao Pipeline (muda o fluxo de arraste e o seletor "mover") — não feito por estar fora do escopo pedido |
| R3 | **Middleware do 404 atrasa o fim da resposta** pelo tempo do commit (ms). Respostas > 1 MB passam a streaming (janela volta a existir só para elas, e são leituras) | baixa | alternativa estrutural (`scope="function"` em ~84 usos) documentada em `03`, não implementada |
| R4 | O deploy do backend **muda o comportamento de todas as respostas** (somente no momento do envio). Recomendado observar latência p95 e erros 5xx após o deploy | média | reverter = remover uma linha em `main.py` |
| R5 | **Lead não encontrado ao ABRIR** o painel é tratado pelas páginas que o abrem (Pipeline/Leads), não pelo drawer; o drawer cobre o 404 que surge numa ação | baixa | — |
| R6 | **Edição inline (D-07)** não implementada (decisão não aprovada). O formulário foi mantido e melhorado | baixa | — |
| R7 | **Última interação (D-01)** continua como era: o painel não exibe esse indicador. Sinais de atenção ("parado há N dias") seguem dependendo de B-1/D-01/D-09 | alta p/ valor de produto | decisão de produto |
| R8 | **Timeline**: o servidor limita a 500 eventos por consulta; abaixo disso não há paginação por cursor (o backend não oferece) | baixa | cursor só com mudança de backend |
| R9 | Ações de **Ligar** abre `tel:`: depende do aparelho/SO ter app de chamadas; no desktop pode não fazer nada | baixa | — |
| R10 | **Arrastar com toque** continua usando o seletor "mover" (HTML5 DnD não suporta toque) — herdado | baixa | — |
| R11 | Contraste/axe medido no Pipeline, no painel e nas 5 etapas do assistente; **não** nas demais telas (Configurações, Agenda…) | baixa | Prompt 08 |
| R12 | `ProspectImportModal` (Prospecção/staff GSM) **não** foi redesenhado e continua com o modal de 640 px | baixa | próxima fase interna |
| R13 | O fluxo de **retomada após recarregar a página** depende de `localStorage` (por design); sem armazenamento, perde-se só a retomada, não os dados | baixa | comportamento herdado |
| R14 | Evidências visuais são do **Chromium** (referência); Firefox e WebKit foram verificados funcionalmente | informativo | — |

## Não alterado de propósito (decisões D-xx)

D-01 (`last_interaction_at`), D-04 (origens fixas), D-05 (sem interações tipadas), D-07 (sem edição inline), D-10 (importação), e as recomendações D-02, D-06, D-08, D-09, D-11, D-12, D-13 — nenhuma regra dependente foi alterada.

## Decisões que preciso de você

1. Estender a confirmação de "perdido" (D-03) ao Pipeline (arraste e seletor "mover")?
2. Aceita o middleware como correção definitiva do 404, ou prefere o caminho estrutural (`scope="function"`) numa fase própria?
3. Quer o mesmo assistente em etapas na importação da Prospecção (staff GSM)?
