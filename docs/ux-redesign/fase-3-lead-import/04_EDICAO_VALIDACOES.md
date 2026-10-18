# 04 — Edição, validações e proteção contra perda

## Formulário (mantido; D-07 não aprovada → sem edição inline)

Quatro grupos com `fieldset/legend`: **Identificação** (Nome\*, Empresa) · **Contato** (Telefone, E-mail) · **Oportunidade** (Valor, Probabilidade, Origem) · **Complementar** (Tags, Notas). Cada campo tem `label` ligado por `htmlFor`; obrigatório é marcado com `*` (decorativo) **e** `aria-required`.

Etapa e Responsável **não** estão no formulário: continuam gravando na hora no Resumo comercial (como antes).

## Validação ao lado do campo (`utils/leadForm.ts`)

| Campo | Regra no navegador | Quem decide de fato |
|---|---|---|
| Nome | obrigatório; ≤ 200 | backend (`min_length=1`, `max_length=200`) |
| Empresa | ≤ 200 | backend |
| Telefone | ≤ 30 | backend (+ `phone_normalized` ≤ 20) |
| E-mail | formato `x@y.z`; ≤ 255 | backend |
| Notas | ≤ 4000 | backend |
| Probabilidade | fora de 0–100 **avisa**, e é ajustada em silêncio ao salvar (comportamento histórico preservado) | backend (0–100) |

- O erro aparece **depois de sair do campo** (`blur`) ou ao tentar salvar; `aria-invalid` + `aria-describedby` + `role="alert"` na mensagem; o foco vai ao primeiro campo inválido.
- Os tetos espelham `UpdateLeadRequest`; o backend continua sendo a autoridade (o erro 422 legível "Empresa: pode ter no máximo 200 caracteres" segue funcionando e o rascunho é preservado).
- "Salvar alterações" fica desabilitado só com nome vazio (como antes); os demais erros bloqueiam ao clicar, com foco no campo.

## Feedback

Toast "Lead atualizado com sucesso"; botão "Salvando…" durante a chamada; erros de API por toast com a mensagem do backend.

## Proteção contra perda acidental

| Situação | Comportamento |
|---|---|
| Esc / clique no fundo em edição ou com comentário digitado | não fecha (como antes) |
| Botão **Fechar lead** com alterações no formulário **ou** comentário digitado | diálogo "Descartar alterações?" (Cancelar mantém tudo) |
| **Cancelar** a edição com alterações | o mesmo diálogo; sem alterações sai direto |
| Indicador | "Alterações não salvas" no rodapé enquanto o formulário difere do lead |

"Sujo" compara com o lead salvo ignorando espaços nas pontas e a ordem das tags (testado em Node).

## Segurança

Nada foi liberado só porque o controle aparece: o reatribuir responsável usa `leads.assign` apenas para **exibir** o seletor; a recusa (403/404) vem do backend e é mostrada por toast (404 também mostra a faixa de "lead não encontrado"). Sessão de suporte somente leitura continua sendo barrada pelo backend.
