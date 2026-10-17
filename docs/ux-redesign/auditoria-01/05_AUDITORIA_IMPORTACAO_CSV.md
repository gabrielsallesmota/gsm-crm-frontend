# 05 — Auditoria da importação CSV

Frontend: `components/leads/LeadImportModal.tsx` (301), `utils/csv.ts`, `types/lead.ts` (`IMPORTABLE_LEAD_FIELDS`, `DedupeStrategy`), `repositories/api/LeadsApiRepository.ts:241-285`, estilos de `prospects/ProspectImportModal.module.css`.
Backend: `POST /api/v1/leads/bulk-import` (`leads/adapters/inbound/router.py:373-434`), `BulkImportRequest`/`ImportRowRequest` (`schemas.py:120-170`), `BulkImportLeadsUseCase` (`leads/application/use_cases.py:~720-860`).

## Fluxo atual

1. Arquivo `.csv` (`readFileAsText`: UTF-8 estrito, senão Windows-1252; remove BOM; detecta `,` ou `;`; RFC 4180 — `csv.ts:18-90`).
2. De/para: uma linha por coluna do arquivo, com a primeira linha de dados como amostra (`LeadImportModal.tsx:248-273`); `guessMapping` casa por nome/rotulo exato.
3. Parâmetros: etapa de entrada, responsável (só admin/gestor), "Se o telefone já existir": ignorar / atualizar / duplicar.
4. Um único `POST` com todas as linhas; resposta com totais e `rows[]` (`created/updated/skipped/error`).
5. Resumo: contadores + lista **somente dos erros** por linha; botão "Ver no pipeline" recarrega o quadro.

**Já existe**: leitura robusta de codificação/separador, mapeamento, tratamento de duplicados no servidor com proteção entre donos (vendedor nunca atualiza lead de outro dono, `use_cases.py:786-800`), resumo por linha, erro de uma linha sem derrubar o lote (nome vazio vira `error`, `schemas.py:122-126`).

## Achados

**IMP-01 · P1 · [C]** Modal fora do padrão de diálogo acessível e fecha em momentos perigosos.
Evidência: `LeadImportModal.tsx:141-142` usa `<div onClick={onClose}>` próprio, sem `role="dialog"`, `aria-modal`, título associado, foco preso/devolvido nem Esc — tudo isso o `Modal` compartilhado já fornece (`Modal.tsx:6-13, 38-48`). Clicar no fundo **fecha e descarta** arquivo e mapeamento a qualquer momento (inclusive **durante** a importação; só o botão Cancelar tem `disabled={importing}`, `:281`). Recomendação: migrar para `Modal` (reaproveita `useDialog` e proteção de dados digitados). Risco: baixo-médio (CSS do `ProspectImportModal.module.css` compartilhado).

**IMP-02 · P1 · [C]** Mais de 2.000 linhas falham o lote inteiro.
Evidência: `rows: list[ImportRowRequest] = Field(min_length=1, max_length=2000)` (`schemas.py:152`); o frontend envia **todas** as linhas num só request, sem limite nem divisão em lotes (`LeadsApiRepository.ts:260-269`, `LeadImportModal.tsx:120-126`). Planilhas maiores recebem 422 genérico ("Não foi possível importar"), sem dizer o motivo. Recomendação: validar e avisar antes; dividir em lotes de ≤ 500 linhas com progresso e consolidar o resumo. Backend: não. Risco: baixo (idempotência: `dedupe_strategy` evita duplicar em reenvio quando é `skip`/`update`).

**IMP-03 · P1 · [C]** Dados descartados em silêncio.
Evidência: valor de "Origem" fora do enum é ignorado (`LeadImportModal.tsx:44`, comentário "ignora em vez de quebrar"); linhas sem nome saem do total (`:50`, `:85-91`). O botão diz "Importar N lead(s)" com N possivelmente menor que o "M linha(s) encontrada(s)" (`:246`) sem explicar a diferença. O usuário só descobre depois, se descobrir. Recomendação: relatório de pré-importação (quantas linhas válidas, com aviso, descartadas e por quê).

**IMP-04 · P1 · [C]** Sem pré-visualização nem validação antes de enviar.
Evidência: só há a primeira linha como amostra (`:252`); nenhuma validação de e-mail, telefone ou UF; erros só aparecem após o processamento (`:168-178`). Para um fluxo que grava em lote, a revisão antes do envio é o principal controle de erro.

**IMP-05 · P2 · [C]** Mapeamento permite escolhas inconsistentes.
Duas colunas apontando para o mesmo campo: a última vence silenciosamente (`buildRow` sobrescreve, `:33-52`). O campo obrigatório "Nome" não é sinalizado: se ninguém mapear Nome, `mappedRows` fica vazio e o botão fica desabilitado sem mensagem (`:292`).

**IMP-06 · P2 · [C]** Rótulos não associados aos selects.
Os títulos são `<div className={styles.label}>` (`:201-241`) e os selects do de/para não têm nome acessível (`:254-271`).

**IMP-07 · P2 · [C]** Motivos de "ignorado" nunca são mostrados.
O backend devolve `detail` ("Telefone já cadastrado para 'X'", `use_cases.py:802-815`), mas a UI lista apenas `outcome === "error"` (`:168-178`). O usuário vê "Ignorados: 37" sem saber quais nem por quê.

**IMP-08 · P2 · [C]** Deduplicação apenas por telefone, e "atualizar" tem escopo limitado.
Chave: `normalize_phone(whatsapp or phone)` (`use_cases.py:778-781`). E-mail e documento não entram. Em "atualizar", telefone, WhatsApp, origem, classificação de aquisição, fonte, site e documento **não** são sobrescritos (`:~815-830`) — a UI diz apenas "Atualizar o cadastro existente". A ajuda precisa dizer o que será atualizado.

**IMP-09 · P2 · [O]** O backend aceita campos que a UI não oferece.
`acquisition_type`, `source_key`, `website_url`, `document_number` e `default_source_id` já existem no contrato (`schemas.py:127-152`); `IMPORTABLE_LEAD_FIELDS` expõe só 10 campos (`types/lead.ts:157-168`). Valor da oportunidade, tags e etapa por linha **não** existem no contrato (exigiriam backend). [D]

**IMP-10 · P3 · [H]** Arquivo grande é processado na thread principal (`parseCsv` síncrono) e não há limite de tamanho. Validar com uma planilha de 2.000 linhas.

## Assistente proposto (4 passos) — o que reaproveitar

| Passo | Existe hoje | Mudança | Exige |
|---|---|---|---|
| 1. Arquivo | `readFileAsText`, `parseCsv` | só visual: zona de soltar, nome, nº de linhas, modelo CSV para baixar, aviso de limite | — |
| 2. Mapear | `guessMapping`, selects | só visual + validação (Nome obrigatório, duplicidade de destino, amostra de 3 linhas) | estado do assistente |
| 3. Duplicados | `dedupeStrategy` | só visual: explicar cada opção e o que será atualizado | — |
| 4. Revisar e importar | `bulkImport` | **pré-validação local** (válidas/avisos/descartadas), importação em lotes com progresso, resultado completo (criados, atualizados, ignorados **com motivo**, erros) e download do relatório | lógica nova no frontend; **sem backend** |

Nada exige novo mecanismo de importação: o endpoint, a deduplicação e as proteções por dono permanecem. Validações essenciais: nome presente; telefone com ≥ 10 dígitos se informado; e-mail com formato; UF com 2 letras; origem reconhecida (ou aviso); linhas em branco ignoradas; tamanho ≤ limite por lote.

## Segurança e integridade

- Servidor protege entre donos e isola por tenant; o frontend não precisa (nem deve) replicar essas regras.
- **Injeção de fórmula** afeta a exportação, não a importação: `GET /leads/export` neutraliza cada célula com `csv_safe_cell` (`router.py:364`, `app/shared/csv_safety.py:18`) [C]. Preservar no redesign.
- Importação grava eventos de timeline por lead e pode disparar webhooks; reenviar um lote falho com `duplicate` cria duplicatas — por isso o assistente deve desabilitar "duplicar" por padrão em reenvios e manter o padrão `skip`.
