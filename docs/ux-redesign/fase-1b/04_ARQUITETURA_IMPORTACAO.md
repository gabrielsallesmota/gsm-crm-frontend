# 04 — Arquitetura da importação em lotes (projeto técnico)

## Requisitos

Até 10.000 linhas; lotes de ≤ 500; pré-importação; progresso real; relatório final com motivo por linha; **idempotência** (reenviar não duplica); falhas parciais explícitas; segurança multi-tenant; **sem migration e sem tabelas novas**.

## Opções avaliadas

| | A — Lotes pelo cliente + `Idempotency-Key` por lote (existente) | B — Job assíncrono no servidor (fila/worker + tabela de importações) | C — Upload do arquivo inteiro e processamento no servidor |
|---|---|---|---|
| Migration / tabelas novas | **Não** (reaproveita `idempotency` durável) | Sim (importação + linhas) | Sim + armazenamento de arquivo |
| Progresso real | Sim (lote a lote) | Sim (polling) | Sim (polling) |
| Sobrevive a fechar a página | Parcial: retomar reenviando a planilha | Sim | Sim |
| Relatório após fechar a página | Não (só na sessão) | Sim | Sim |
| Superfície de segurança nova | Nenhuma | Alta (arquivos/jobs por tenant) | Alta (upload, malware, retenção/PII) |
| Esforço / risco | Baixo | Alto | Alto |

**Escolhida: A+** (A com retomada por assinatura). Justificativa: atende a todos os requisitos pedidos sem migration nem mudança estrutural, reutiliza um mecanismo já testado (idempotência durável, mesma transação do lote, TTL 24 h, 409 em processamento, 422 para corpo diferente, reserva presa expira em 60 s). B/C ficam como evolução se for exigido relatório *após* fechar a página (ver `09`).

## Desenho

```
CSV → parse (navegador) → mapeamento → prepareRows (valida, separa válidas × inválidas)
    → chunk(500) → para cada lote, em ordem e UM por vez:
         POST /api/v1/leads/bulk-import  (header Idempotency-Key: imp-<importId>-<nnnn>)
         ↳ falha transitória (rede, 408/409/429/5xx): reenvia o MESMO lote com a MESMA chave (até 3×, backoff 0,8/2/4 s)
         ↳ falha de regra (4xx): para, mantém os lotes já gravados
    → buildReport (inválidas + resultado de cada lote + lotes não confirmados/não processados)
```

- **Chave por lote**: `imp-<importId>-<índice com 4 dígitos>` (≤ 128). Mesma chave + mesmo corpo → o servidor devolve a resposta gravada (`Idempotent-Replayed: true`) sem gravar; vale também para a estratégia "duplicar", onde reenvio ingênuo duplicaria.
- **Retomada**: `importId` é guardado em `localStorage` (por tenant + usuário) com uma **assinatura** (arquivo, tamanho, nº de linhas, pipeline, etapa, responsável, estratégia, mapeamento). Mesma assinatura em < 20 h reaproveita o `importId`: lotes já gravados voltam como repetição (relatório sai completo) e só os faltantes são criados. Concluiu sem interrupção → a chave é apagada (próxima importação do mesmo arquivo é nova).
- **Cancelar**: efeito após o lote em andamento; o que foi gravado permanece; "Retomar importação" continua do ponto.
- **`beforeunload`** só enquanto roda.
- **Limites**: 10.000 linhas e 5 MB, checados **antes** de qualquer envio (mensagem "Nada foi importado").
- **Motivo por linha estável**: o backend devolve `reason` (`validation` | `duplicate` | `permission`), então a tela não depende do texto de `detail`.

## Contrato da API (aditivo, compatível)

`POST /api/v1/leads/bulk-import`: header opcional `Idempotency-Key`; resposta `rows[].reason` novo e opcional. Sem o header o comportamento é o anterior. Limite do servidor (2.000/requisição) mantido. Auditoria `leads.imported` por lote com **contagens e identificadores apenas**.

## Estados

Aguardando · Validando · Processando · Concluído · Concluído com erros · Falhou · Cancelada. "Concluído" só quando não há rejeição nem lote não confirmado.
