# 07 — Falhas parciais, retries e consistência dos relatórios

Todas as falhas abaixo são injetadas **na rede, entre o navegador e a API real** (`page.route`), e o estado final é conferido **na API** (banco isolado). Nenhum comportamento do servidor é simulado.

## Matriz de cenários (E2E, Chromium)

| Cenário | O que acontece | Evidência |
|---|---|---|
| Falha no **1º lote** (403) | 1 tentativa (4xx de regra não repete), "Falhou", **0 gravados**, mensagem "…lote 1 de 2"; "Retomar" conclui (1.000 únicos) | ok |
| Falha no **2º lote** | lote 1 permanece (500 gravados); relatório: 500 criados + **500 "não confirmadas"** com **números originais** (ex.: "Linha 502 (Lead 00500)"); | ok |
| Falha no **último lote** (3 lotes) | 1.000 gravados; "Retomar" grava só o 3º; total 1.200 únicos | ok |
| **Timeout depois de gravar** (resposta perdida) com estratégia **duplicar** | reenvio com a **mesma chave**; servidor devolve o lote já gravado (`Idempotent-Replayed: true`); **500 leads, não 1.000**; "Criados: 500" contado **uma vez** | ok |
| **Falha antes de gravar** (conexão cai 2×) | 3ª tentativa grava; **uma única vez**; não é replay | ok |
| Resposta **429** | repete com a mesma chave e conclui | ok |
| Resposta **500** | repete com a mesma chave e conclui | ok |
| Resposta **409** (em processamento / lock) | repete com a mesma chave e conclui | ok |
| Resposta **422** | **não** repete; "Falhou" com a mensagem do servidor | ok |
| **Reinício REAL do backend** no meio (processo derrubado na 2ª requisição) | "Falhou"; backend sobe de novo; lote 1 sobreviveu; "Retomar" conclui; **1.500 telefones únicos** | ok (`restart.spec.ts`, rodada manual com servidores já em pé) |
| Cancelar | termina o lote em andamento, não envia o seguinte; "Cancelada"; 500 gravados; retomar com "duplicar" **não** regrava o lote 1 | ok |
| Recarregar a página no meio | planilha igual → identidade reaproveitada; lote 1 = replay, lote 2 gravado | ok |

## Defeito corrigido: a linha "venenosa" tornava a importação irrecuperável

Uma única linha com valor maior que a coluna do banco (`company` > 200, `position` > 120, `phone`/`whatsapp` > 30, `email` > 255, `city` > 120, `notes` > 4.000) derrubava o **lote inteiro** com **500** (`StringDataRightTruncationError`). Como 500 é repetido e **falha sempre**, o usuário ficava preso: "Falhou" em loop, sem como pular a linha ruim e sem saber qual era.

- **Servidor:** `validate_import_field_lengths` valida cada linha no mesmo ponto do nome; a linha vira `error` com `reason = "validation"` e a mensagem ("Observações tem 4001 caracteres; o máximo é 4000.") e **as demais entram**. Telefone com dígitos demais para `phone_normalized` (20) também.
- **Navegador:** a mesma regra roda antes de enviar (`prepareRows`), então a linha aparece como **inválida na pré-importação** com o número da linha.
- Testes: 8 de backend (7 campos + limites exatos) e 1 E2E (linha venenosa entre duas boas: 2 criadas, 1 erro, e também a chamada direta à API sem validação do cliente).
- **Não corrigido (fora de escopo, registrado):** criar/editar lead **manualmente** com campo acima do limite ainda devolve 500 (mesma causa, outro endpoint).

## Consistência dos números

- O contador de **processadas/criadas** só avança com a resposta confirmada do servidor (prova no E2E: a resposta é retida na rede após o servidor gravar; a barra permanece em 0 até liberar e então vai a 500, depois 1.000).
- Em 10.000 linhas o progresso amostrado é **monotônico e sempre múltiplo de 500**.
- "Concluído" só aparece sem rejeições nem lotes não confirmados; senão "Concluído com erros" / "Falhou".
- Resultado **não confirmado** (rede) é diferente de **rejeitado** (validação): categorias separadas ("Erro de processamento (não confirmado)" × "Falha de validação") e a mensagem do lote orienta que **retomar é seguro**.
- Sem rollback global dos lotes já concluídos (decisão de produto não tomada): o que foi gravado permanece e o relatório diz quanto.
