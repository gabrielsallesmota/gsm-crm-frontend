# 06 — Retomada segura e janela de idempotência (risco R4)

## O que o servidor garante (e até quando)

Cada lote tem uma chave `imp-<importId>-<n>`. O servidor guarda a resposta por **24 h** a partir do **primeiro envio** do lote (`expires_at = created_at + 24 h`, medido em teste). Depois disso a chave é **esquecida**: reenviar o mesmo lote executa de novo.

Evidência de backend (`test_import_idempotency_window_stabilization.py`, 5 testes):

| Situação | Resultado |
|---|---|
| expiração = created_at + 24 h | confirmado (±5 s) |
| 1 min antes de expirar | **replay** (não regrava) |
| 1 s depois de expirar, estratégia **duplicar** | regrava: **10 leads em vez de 5** (duplicação técnica) |
| 1 s depois de expirar, estratégia **ignorar** | inofensivo: 0 criados, 5 ignorados |

Por isso a tela **não pode** retomar depois da janela.

## Defeitos encontrados na 1B (corrigidos)

1. **A janela era renovada a cada tentativa.** O registro guardava `at: Date.now()` e era regravado em toda retomada: uma importação retomada de hora em hora nunca "vencia" no cliente, mas o servidor esquecia as chaves 24 h depois do **primeiro** envio.
2. **Registros apagados ao completar 24 h.** Sem o registro, reabrir a mesma planilha **não avisava nada**: com "duplicar", o reenvio gravava tudo de novo, em silêncio.
3. **"Retomar importação" na mesma tela não conferia a idade.**
4. Um registro por usuário: importar outra planilha apagava o registro da interrompida.

## Regras implementadas

| Regra | Valor / comportamento |
|---|---|
| Janela segura | **20 h a partir do INÍCIO** da importação (primeiro envio). Folga de **4 h** sobre as 24 h do servidor: cobre relógio do aparelho, notebook em suspensão e a duração do próprio reenvio (a replay de 20 lotes leva segundos). Nunca é renovada. |
| Relógio | Registro com início "no futuro" além de 5 min, ou corrompido → tratado como **vencido** (não arrisca). |
| Registro | um por (tenant, usuário, **assinatura** = arquivo + tamanho + nº de linhas + pipeline + etapa + responsável + estratégia + mapeamento). Mudar qualquer coisa = outra importação. Só guarda `{assinatura, importId, início}`: **sem dado pessoal**. |
| Vencida | **nada é reenviado**. Painel de alerta: "A proteção contra duplicação desta importação venceu… Nada foi reenviado… podem já ter sido importados". |
| Recuperação | botão **"Preparar nova importação"**: apaga o registro, gera nova identidade e **não envia** (a pessoa confirma). Se a estratégia era "duplicar", ela vira **"ignorar"** — a recuperação nunca oferece duplicar. |
| Retenção do aviso | o registro é lembrado por **30 dias** só para **avisar** que a planilha já foi enviada (depois disso é apagado). |
| Mesma tela | "Retomar importação" também confere a janela (relógio avançado → bloqueia). |
| Mensagem de sucesso | "retomou uma importação interrompida (iniciada em …, dentro da janela de 24 h)": só aparece quando o registro estava **dentro** da janela. |

### Por que não aumentar o TTL?

Não foi feito: a tabela `idempotency_keys` guarda a **resposta completa** (até 500 linhas por lote) por chave; TTL maior = mais armazenamento e limpeza, e afeta **todas** as operações (API pública, webhooks, agenda). A janela de 24 h é suficiente para o caso de uso (retomar no mesmo dia).

## Testes

- Node (`leadImport.test.ts`): 1 h, 19 h, 19 h 59 min → fresca; 20 h, 24 h, 3 dias → vencida; assinatura diferente; relógio no futuro; registro corrompido.
- Vitest (`leadImportModal.spec.tsx`, 14 casos R4): retomada 1 h/19 h/19 h 59; bloqueio 20 h/24 h/3 dias; "preparar nova importação" não envia e troca a identidade; "duplicar" vencida vira "ignorar"; retomar não renova a janela; "Retomar" na mesma tela com relógio avançado; **mudança de arquivo, de estratégia e de mapeamento** não reaproveitam; **outro usuário e outro tenant** não enxergam o registro; duas abas = mesma identidade; poda após 30 dias.
- E2E (navegador real): recarregar a página e reenviar a mesma planilha → **lote 1 reconhecido pelo servidor (`Idempotent-Replayed: true`), lote 2 gravado, 1.000 únicos**; registro envelhecido para 25 h → bloqueio, **0 requisições**, recuperação com "ignorar" conclui sem duplicar.

## Limites honestos

- A janela é contada no **relógio do aparelho**; se o usuário mudar a hora do computador para trás, o registro pode parecer mais novo do que é (a folga de 4 h absorve pequenas diferenças, não manipulação).
- Se o armazenamento local for apagado, a tela não sabe que a planilha já foi enviada. Com "ignorar" (padrão) é inofensivo; com "duplicar" o risco é do usuário que escolheu duplicar.
- O relatório detalhado de uma importação interrompida **só é reconstruído** reenviando a mesma planilha dentro da janela (replay).
