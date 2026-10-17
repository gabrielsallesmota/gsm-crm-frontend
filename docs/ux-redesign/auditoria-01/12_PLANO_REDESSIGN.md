# 12 — Plano de redesign (proposta; nada foi implementado)

Visão aprovada: simplicidade do Trello + inteligência comercial do Pipedrive, com **progressive disclosure** e identidade própria. Estratégia: evolução incremental sobre o código existente, sem reescrita, sem nova dependência de UI e sem alterar regras de negócio, contratos de API, permissões ou isolamento (ver 09).

## Princípios de UX

1. **O essencial à vista, o resto sob demanda**: busca, responsável e período visíveis; ordenar, importar, exportar e limpar filtros em "Mais".
2. **O card responde "o que fazer agora?"**: nome, valor, responsável e uma única faixa de status (atrasado / próxima ação / parado há N dias).
3. **Uma ação principal por contexto**: "+ Lead" no quadro; "Contatar" no lead; "Importar" no assistente.
4. **Nada destrutivo sem confirmação**, com o efeito colateral dito em linguagem simples.
5. **Estado preservado**: filtros e lead aberto refletidos na URL.
6. **Acessível por padrão**: rótulos, foco, alvos ≥ 24 px (44 px em toque), contraste ≥ 4,5:1, alternativa ao arrastar.

## Componentes reutilizáveis a criar (todos sobre CSS Modules e tokens existentes)

| Componente | Substitui / reaproveita | Observação |
|---|---|---|
| `Field` (rótulo + controle + dica + erro) | `div.fieldLabel` + inputs soltos | resolve DRW-01, IMP-06, CFG-06/07 |
| `StatusStrip` (atrasado / próxima ação / parado) | novo no `KanbanCard` | alimentado por `next_cadence_step` na fase 1 |
| `LeadCard` (extraído de `KanbanCard`) | `KanbanCard` interno | sem interativo aninhado; ações irmãs |
| `ActionMenu` ("Mais", "Mover para…", menu de coluna) | `select.cardMove`, botões soltos | acessível por teclado |
| `FilterBar` + `useUrlFilters` | `useState` de filtros | sincroniza com a URL |
| `Wizard` (passos, validação por passo) | `LeadImportModal` | reaproveita `Modal` e `useDialog` |
| `ImportReport` (válidas/avisos/descartadas/erros) | contadores do resumo | também exibe "ignorados" com motivo |
| `SettingsLayout` + menu lateral | `SettingsPage` monolítico | sub-rotas |
| `SectionCard` recolhível | seções do drawer | estado preservado |
| `ConfirmDialog` com `impact` | `ConfirmDialog` | recebe lista de efeitos (ex.: "apaga 3 templates") |
| `Modal` (existente) | `LeadImportModal` | passa a ser usado também pela importação |

## Fases e sequência segura

Cada fase é entregável, reversível e termina com testes verdes (lint, tipos, testes, build). Sem migration em nenhuma das fases 0–3.

**Fase 0 — Rede de segurança (sem mudança visual)**
Testes de componente para `PipelinePage` (carregar, mover, rollback, filtros), `LeadDrawer` (editar, mover, tarefa, comentário, excluir), `LeadImportModal` (mapear, dedupe, resultado, erro) e `SettingsPage` (pipelines/etapas/tags/templates); teste de matriz de permissões por papel. *Critério:* cobrem F-01..F-38 da matriz.

**Fase 1 — Correções de integridade e acessibilidade (baixo risco)**
- Importação: limite e lotes de ≤ 500, relatório de pré-importação, motivos de ignorados, `Modal` compartilhado, `role="alert"` (IMP-01..03, 06, 07, A-10).
- Rótulos em todos os campos do escopo (DRW-01, CFG-06/07).
- Confirmação de excluir tag/template; aviso de cascata de etapa (CFG-02/03).
- Ordenação por `sort_by` do servidor; corrigir comentários desatualizados (PIP-02, CFG-08, BE-04).
- Contraste: trocar `--faint` em texto por `--muted-2` (PIP-15, SYS-03).
*Critério:* sem mudança de layout; testes da Fase 0 inalterados + novos casos.

**Fase 2 — Pipeline (card e cabeçalho)**
- Extrair `LeadCard` (sem interativo aninhado), `ActionMenu` "Mover para…", realce de destino no arrastar (PIP-01, 04, 05, 11).
- `StatusStrip` com `next_cadence_step` (PIP-03 fase 1).
- Cabeçalho de contexto e menu "Mais"; filtros na URL; presets de período reavaliados (PIP-06..08, 14).
- Manter a lista atual de ações; nada é removido, só reposicionado.
*Critério:* paridade funcional (F-01..F-13), checagem manual de teclado e leitor de tela.

**Fase 3 — Painel do lead**
- Extrair subcomponentes (`LeadHeader`, `LeadFacts`, `LeadTasks`, `LeadActivity`).
- Cabeçalho fixo com contexto e ações de contato; seções recolhíveis (alternativa B do doc 04); `?lead=` na URL; "Ver mais" na timeline; validação inline (DRW-02..05, 08, 10).
*Critério:* nenhuma ação perdida (F-14..F-22).

**Fase 4 — Configurações em sub-rotas e assistente de importação**
- `SettingsLayout` com menu; mover blocos sem alterar a lógica; preservar `ROUTES.*` e guardas (CFG-01, 05, 09).
- Assistente de 4 passos reaproveitando `parseCsv`, o mapeamento e `bulk-import` (IMP-04, 05, 08, 09).
*Critério:* links do onboarding e dos estados vazios continuam válidos.

**Fase 5 — Indicadores completos (depende de backend e decisões)**
- Campos agregados na listagem (`next_activity_at`, `overdue_tasks_count`, `stage_entered_at`, `last_activity_at`) e total por etapa (B-1, B-2), com fallback no frontend quando ausentes; só depois de D-01, D-02, D-09, D-13.
- Registro de tipo de interação (D-05, B-5) e motivo de perda (D-03, B-3) se aprovados.
*Critério:* contrato retrocompatível (campos opcionais); testes de integração no backend, incluindo isolamento entre tenants.

## Estratégia de testes e regressão

Pirâmide: utilitários (`node --test`) → componentes (Vitest + Testing Library) → integração do backend para qualquer campo novo. Checklist manual por fase: teclado, leitor de tela, 360/768/1440 px, zoom 200 %, temas claro e escuro, papéis admin/gestor/vendedor, sessão de suporte da GSM (somente leitura), staff GSM com área interna. Cada PR mapeia as linhas da matriz (09) que toca.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Regressão em componentes compartilhados (`Modal`, `PeriodFilter`, `WhatsappButton`, `LeadDrawer`) | Fase 0; mudanças atrás de testes; PRs pequenos |
| CSS compartilhado entre módulos (`ProspectImportModal.module.css`) | copiar para CSS próprio ao migrar a importação |
| Mudar semântica de "última interação" | só após D-01; rotular o campo atual como "última movimentação" |
| Performance com agregados na listagem | consultas em lote, índices existentes (`lead_events(lead_id, created_at)`, `lead_tasks(tenant_id, done, due_at)`) e teste de carga com 10 mil leads |
| Perder deep links (`?importar=1`, `?novo=1`) | manter e cobrir com testes |
| Divergência entre staff GSM e tenants | testar com `isPlatformStaff` verdadeiro e falso |

## Fora do escopo desta auditoria

Dashboard, Tarefas, Agenda, Relatórios, Equipe, Prospecção (SDR) e a área da plataforma. Eles compartilham componentes (`Modal`, `PeriodFilter`, `Badge`, `EmptyState`) e entram nos testes de regressão, mas não foram auditados.
