# 11 — Decisões pendentes (Product Owner)

Cada decisão bloqueia ou orienta itens específicos. "Padrão sugerido" é a recomendação da auditoria, não uma decisão tomada.

| ID | Questão | Contexto / evidência | Padrão sugerido | Bloqueia |
|---|---|---|---|---|
| D-01 | O que conta como **"última interação"**? | `last_interaction_at` só muda ao mover de etapa (`use_cases.py:670`). Comentário, tarefa concluída, ligação, WhatsApp e atividades externas não o atualizam. | Considerar: comentário, tarefa concluída, atividade de integração e movimentação; excluir edição de dados | B-1, DRW-02, PIP-03 (fase 2), follow-up |
| D-02 | O filtro de período deve usar **data de criação** ou **atividade/movimentação**? | Hoje: criação (`repository.py:229-233`). Rótulos "Hoje/7 dias" sugerem atividade. | Manter "criados em" e rotular; criar filtro "parados há N dias" à parte | PIP-07 |
| D-03 | Perder um lead deve exigir **motivo** (e/ou confirmação)? | Hoje não há; Ganho/Perdido alimentam conversão. A Prospecção interna já tem motivos de perda. | Confirmação simples agora; motivo opcional depois | PIP-09, B-3 |
| D-04 | **Origens**: continuam fixas ou passam a ser configuráveis (`/lead-sources`)? | Backend pronto; frontend usa enum. Afeta templates (chave por origem), importação e relatórios. | Manter fixas no redesign; migrar em etapa própria | CFG-04, IMP-09 |
| D-05 | Registrar **tipo de interação** (ligação, WhatsApp, e-mail, reunião) na UI? | Hoje só comentário; `activity` só por integrações. | Sim, como evolução após o cabeçalho de contexto | DRW-06, B-5 |
| D-06 | Vendedor pode **excluir** os próprios leads? | `DeleteLeadUseCase` permite ao dono; auditado. | Manter por ora; revisar com a gestão | DRW-07 |
| D-07 | Salvamento do painel: **inline por campo** ou botão Salvar? | Modelo misto atual (DRW-03). | Inline por campo com confirmação visual, mantendo "Editar" para dados cadastrais longos | DRW-03 |
| D-08 | Abas, seções ou duas colunas no painel do lead? | Comparativo em 04. | Coluna única com cabeçalho fixo e seções recolhíveis | DRW-02 |
| D-09 | O **valor total por etapa** e o "tempo na etapa" entram no card? | Exigem agregados (B-1, B-2). | Sim, em campos opcionais, com fallback se o backend ainda não os enviar | PIP-13, PIP-03 |
| D-10 | Limite do tamanho de importação para o usuário | Backend: 2.000 por requisição; lotes no frontend permitiriam mais. | Aceitar até 10.000 linhas em lotes de 500, com progresso | IMP-02 |
| D-11 | A importação deve aceitar **valor**, **tags** e **etapa por linha**? | O contrato não tem esses campos (`schemas.py:127-142`). | Não nesta rodada | IMP-09 |
| D-12 | Onde ficam as configurações **internas da GSM** (Prospecção)? | Misturadas em `/configuracoes` para staff. | Seção/rota própria rotulada "Equipe GSM" | CFG-01 |
| D-13 | Para leads **anteriores à migration 0054** (sem eventos), tempo na etapa pode ser impreciso. Aceitável? | Sem backfill (docstring da migration). | Aceitar e rotular "desde o registro" | BE-02, PIP-03 |

## Itens que exigem validação com usuários [V]

Relevância dos sinais no card (atrasado / próxima ação / parado há N dias); preferência por período de criação vs. atividade; adequação de 25 cards por coluna; uso real de ordenação, exportar e reordenar colunas (para definir o que vai ao menu "Mais"); necessidade de duas colunas em telas largas; compreensão do rótulo "Passivo/Ativo" para staff.
