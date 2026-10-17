# 05 — Importação implementada

## Backend (`gsm-crm-backend`)

| Arquivo | Mudança |
|---|---|
| `leads/adapters/inbound/router.py` | `POST /bulk-import` aceita `Idempotency-Key` (operação `leads.bulk_import`, escopo tenant + usuário); replay com `Idempotent-Replayed: true`; `complete` na mesma transação; `release` em falha; auditoria `leads.imported` por lote (só contagens/IDs, `batch_key`). Sem header = comportamento anterior. |
| `leads/application/dtos.py`, `use_cases.py`, `schemas.py` | `ImportRowResult.reason` (`validation` / `duplicate` / `permission`; `None` em sucesso). |
| `leads/adapters/outbound/repository.py` | Ordenação determinística: `NULLS LAST` + desempate por `id` (corrige paginação instável). |

Sem migration. Sem endpoint novo (mesmo `POST /api/v1/leads/bulk-import`, extensão aditiva).

## Frontend (`gsm-crm-frontend`)

| Arquivo | Papel |
|---|---|
| `utils/leadImport.ts` (novo) | Motor puro: `prepareRows`, `chunk`, `checkLimits`, `runImport` (lotes, retentativas com a mesma chave, retomada, cancelamento), `buildReport`, `finalState`, `reportToCsv`/`csvSafeCell`, `signatureOf`, `newImportId`. |
| `components/leads/LeadImportModal.tsx` | Prévia, progresso, relatório, retomada, cancelamento, `beforeunload`. |
| `types/lead.ts`, `LeadsRepository`, `LeadsApiRepository`, `LeadsMockRepository`, `useLeadActions` | `idempotencyKey?` e `reason`. |
| `tests/ui/support/setup.ts` | `localStorage` em memória quando o do Node/jsdom lança (necessário para testar a retomada); limpo entre testes. |

## Experiência

1. **Pré-importação** (antes de enviar): arquivo, linhas, válidas/inválidas (com exemplo e número da linha), nº de lotes, avisos (origem desconhecida → lead entra sem origem; telefone com < 10 dígitos → sem dedupe por telefone) e a ressalva de que "válida" ≠ "será criada".
2. **Processando**: `<progress>` real, "Enviando lote X de Y (nova tentativa N)", contadores acumulados, **Cancelar importação** (após o lote atual), fechamento do diálogo bloqueado.
3. **Resultado**: estado (Concluído / Concluído com erros / Falhou / Cancelada), totais por categoria (criados, atualizados, duplicados ignorados, sem permissão, falha de validação, não confirmadas), lista com **número original da linha** e motivo (200 primeiras), **Baixar relatório (CSV)** só com o que precisa de atenção (fórmulas neutralizadas, BOM para Excel), **Retomar importação**.
4. Fechar após gravar algo recarrega o quadro.

## Semântica preservada

3 estratégias de duplicados (no "atualizar": telefone/WhatsApp atualizados; origem, classificação de aquisição, fonte, site e documento **não**); vendedor sempre importa para si; mesmos gates de permissão; RLS.

## Regras de validação no navegador

Nome obrigatório e ≤ 200; UF ≤ 2 letras (antes, uma UF inválida derrubava o **lote inteiro** com 422). Origem fora do enum deixou de ser descartada em silêncio: vira aviso. Limites 10.000 linhas / 5 MB com mensagem antes de qualquer envio.
