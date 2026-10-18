# 10 — Riscos e pendências

## Defeitos achados DURANTE a fase (pelo E2E em navegador real — jsdom não os pegaria)

| # | Achado | Situação |
|---|---|---|
| 1 | **O arraste nativo deixou de soltar** depois do 1º desenho do redesign: o realce "Soltar aqui" era inserido no fluxo, deslocava os cartões sob o ponteiro e o Chromium cancelava o *drop* (eventos: `dragstart → dragenter → dragleave → dragend`, sem `drop`). Os testes de jsdom (eventos sintéticos) passavam. | **corrigido**: sobreposição `position: absolute; pointer-events: none`, dica da coluna vazia com espaço reservado, saída da coluna decidida pela **posição do ponteiro** (`relatedTarget` vem nulo no Chromium); teste CSS + E2E real em 3 navegadores |
| 2 | Textos `.sr-only` das colunas fora da área visível alargavam a **página** (93 px em 768 px) | corrigido (`.board { position: relative }`) |
| 3 | Menu lateral recolhido vazava sombra e mantinha links invisíveis na ordem de Tab | corrigido |
| 4 | Ordem de Tab do cartão mudou (resumo → WhatsApp → e-mail → seletor); testes antigos esperavam o seletor logo após o resumo | testes atualizados; ordem é a do DOM (lógica) |

## Pendências e riscos residuais

| # | Item | Gravidade | Decisão/ação |
|---|---|---|---|
| P1 | **Leitor de tela real (NVDA/VoiceOver)** não foi executado; só atributos/árvore de acessibilidade | média | validação manual antes de liberar para clientes |
| P2 | **Arrastar com toque** (HTML5 não suporta) — o caminho em celular/tablet é o seletor "mover" | baixa | decisão herdada (PIP-11); biblioteca de arraste só com decisão |
| P3 | **Valor total por etapa/pipeline exato** exige agregado do servidor (B-2). Hoje a soma só aparece com a coluna inteira carregada | média | opcional; melhora o cabeçalho; sem migration |
| P4 | **Sinais de atenção** (atrasado, próxima ação, parado há N dias) não existem: dependem de B-1 e da decisão **D-01** (o que é "última interação") | alta p/ valor de produto | deliberadamente **não** implementado |
| P5 | Filtros **não persistem na URL** (PIP-06) | média | fora do escopo desta fase |
| P6 | Suspeita de **leitura logo após escrita**: o commit da sessão ocorre depois da resposta (FastAPI ≥ 0.118 executa a saída das dependências com `yield` após enviar a resposta). Em E2E, sob carga da máquina, "criar lead e comentar na hora" devolveu 404 em 3 de ~30 semeaduras; **não reproduzido em isolamento (0/60)** | média (afeta integrações que encadeiam chamadas) | **não alterado** (mexe em todos os endpoints); a semeadura do E2E tem 3 tentativas. Recomendação: `Depends(..., scope="function")` no `get_tenant_db`, em fase própria com testes |
| P7 | Contraste foi medido só no Pipeline e no diálogo de importação (axe), não em todas as telas | baixa | Prompts 07/08 |
| P8 | `ProspectionBoard` (staff GSM) não foi redesenhado; compartilha `WhatsappButton.module.css` (ganhou o contraste corrigido) e o `PeriodFilter` | baixa | próxima fase interna |
| P9 | Cabeçalho do cartão de coluna oculta as setas de reordenar até hover/foco (mouse); em teclado/toque aparecem | baixa | verificar com usuários |
| P10 | O avatar usa iniciais e cor neutra; sem foto/cor por pessoa | baixa | estético |
| P11 | O Gate Zero foi validado por E2E de API (limites) + pytest completo; a rodada completa de UI do Gate Zero rodou *antes* do commit com o redesign em andamento no working tree (falhas de seletor esperadas) — a rodada completa **com o redesign** está em `08` | informativo | — |

## Decisões que precisam de você

1. Implementar **B-2 (soma por etapa no servidor)** e/ou **B-1 (campos de atenção)**? Dependem de D-01/D-09.
2. Tratar **P6** (commit antes da resposta) como correção de backend em fase própria?
3. Quer **menu "⋯" por cartão** (mover/arquivar/etc.) ou o seletor nativo basta?
4. Persistir filtros na URL (PIP-06) antes do Prompt 07?

## Restrições respeitadas

Sem commit do redesign; sem push/merge/deploy; sem migration; sem nova dependência de produção (as duas de teste vieram do Prompt 05); backend intacto nesta fase (só o Gate Zero); drawer, importação CSV e Configurações **não** alterados.
