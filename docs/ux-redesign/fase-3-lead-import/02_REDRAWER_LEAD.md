# 02 — Redesign do painel do lead (drawer)

## Pergunta → onde o painel responde

| Pergunta | Onde |
|---|---|
| Quem é este lead? | Cabeçalho fixo: avatar, nome (título do diálogo, `h2`), empresa/cargo |
| Em qual etapa está? | Selo da etapa no cabeçalho + seletor "Etapa" no Resumo comercial (grava na hora) |
| Quem é o responsável? | Chip no cabeçalho + "Responsável" no Resumo (admin/gestor reatribuem; vendedor só vê) |
| Qual o valor? | Resumo comercial: Valor, Probabilidade, Origem, Criado em |
| O que aconteceu recentemente? | Atividades: comentários, tarefas, movimentações, mudanças de dados, integrações |
| Qual a próxima ação? | Tarefas: a primeira pendente por vencimento vira o bloco "Próxima ação" (vermelho se atrasada) |
| Como entrar em contato? | Ações rápidas (WhatsApp, Ligar, E-mail) + seção Contato com telefone e e-mail sempre à vista |
| Como atualizar os dados? | "Editar" abre o formulário agrupado; rodapé fixo com Cancelar/Salvar |

## Estrutura (uma coluna, sem múltiplas telas)

```
Cabeçalho fixo ── nome · empresa · etapa · responsável · [Fechar]
  Ações rápidas ─ WhatsApp · Ligar · E-mail · Editar
Corpo rolável
  Resumo comercial   (Etapa, Responsável, Valor, Probabilidade, Origem, Criado em)
  Contato            (Telefone, E-mail)
  Dados complementares (disclosure: Notas e Tags; abre sozinho se houver conteúdo)
  Tarefas            (Próxima ação em destaque + demais; "+ Nova tarefa")
  Atividades         (comentar + timeline com "Ver mais")
  Excluir lead
Rodapé fixo (só em edição) ── "Alterações não salvas" · Cancelar · Salvar alterações
```

Largura 520 px no desktop (antes 460) e 100% no celular. Seções secundárias usam *progressive disclosure*; a
densidade do cabeçalho não muda com o conteúdo.

## Componentização incremental (o `LeadDrawer` não foi reescrito do zero)

`LeadDrawer.tsx` (619 → ~390 linhas) ficou só com estado e chamadas; a apresentação foi para `components/leads/drawer/`:

| Arquivo | Papel |
|---|---|
| `DrawerHeader.tsx` | cabeçalho, chips e ações rápidas |
| `LeadSummary.tsx` | resumo comercial; etapa/responsável gravam na hora |
| `LeadContact.tsx` | telefone e e-mail |
| `MoreDetails.tsx` | notas e tags sob demanda |
| `LeadEditForm.tsx` | formulário agrupado com validação por campo |
| `TasksSection.tsx` | tarefas + próxima ação |
| `ActivitySection.tsx` | comentário + timeline + "Ver mais" |
| `utils/leadForm.ts` | regras puras (valores, validação, "sujo?", `tel:`) — testadas em Node |

## Contratos preservados (Pipeline, testes e E2E dependem deles)

- Props de `LeadDrawer` inalteradas (`lead`, `stages`, `templates`, `onClose`, `onSaved`, `onDeleted`).
- Diálogo **"Lead <nome>"**, botão **"Fechar lead"**, **"Excluir lead"** → `ConfirmDialog` "Excluir lead?".
- Foco volta ao elemento que abriu; Esc e clique no fundo não descartam edição/comentário em andamento.
- Mesmos rótulos acessíveis dos campos: Nome, Empresa, Telefone, E-mail, Valor, Probabilidade, Origem, Notas, Etapa, Responsável, "Novo comentário".
- Mesmas chamadas à API (`update`, `move`, `delete`, comentários, tarefas, `timeline`); nenhuma rota nova.

## Ações de contato

WhatsApp e E-mail são os componentes que já existiam (mesmas regras de template/mailto). **Ligar** é um link `tel:`
que só aparece com ≥ 8 dígitos (assume Brasil para números nacionais). Nenhuma integração nova foi criada.

## Estados tratados

| Estado | Comportamento |
|---|---|
| Carregando tarefas/timeline | "Carregando…" + esqueletos; dados antigos permanecem durante recarga |
| Erro ao carregar | mensagem própria; timeline oferece "Tentar de novo" |
| Sem tarefas / sem histórico | "Nenhuma tarefa para este lead." / "Sem atividades registradas ainda." |
| Sem notas/tags | "Sem notas ou tags. Use Editar para adicionar." |
| Campos vazios | "—" |
| Lead não encontrado (404 numa ação) | faixa `role=alert` "Este lead não foi encontrado…" + "Fechar e atualizar o quadro" |
| Sem permissão (403) | toast com a mensagem do backend; a UI não se esconde sozinha (o backend é a autoridade) |

O painel recebe o `lead` já carregado pelo Pipeline; "lead não encontrado" ao **abrir** é tratado pelo próprio Pipeline/Leads
(fora desta fase). Aqui o 404 é tratado quando surge numa ação.

## Decisões de produto respeitadas

- **D-01**: `last_interaction_at` não foi tocado; nenhum indicador de "última interação" foi inventado.
- **D-03**: mover para etapa **perdida** pede confirmação ("Marcar como perdido?"), sem motivo obrigatório. Ganho não pede.
- **D-04/D-05/D-07**: origens fixas; sem novo registro tipado de interações; **sem edição inline** (o formulário foi mantido).
