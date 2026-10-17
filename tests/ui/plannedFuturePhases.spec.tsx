// FASE 0 — cenários PLANEJADOS do frontend (`it.todo`): aparecem no relatório como pendentes e
// NUNCA como verdes. Cada um aponta a decisão (D-xx) ou fase que o ativa. Ver
// docs/ux-redesign/fase-0-testes/07_TESTES_FUTUROS.md.
import { describe, it } from "vitest";

describe("PLANEJADO — D-10 importação em lotes (até 10.000 linhas, lotes de 500, com progresso)", () => {
  it.todo("10.000 linhas são divididas em 20 requisições de até 500, em ordem");
  it.todo("a barra de progresso reflete lotes concluídos/total e o botão Cancelar interrompe após o lote atual");
  it.todo("falha em um lote: os anteriores permanecem e o relatório final lista as linhas do lote que falhou");
  it.todo("reprocessar o mesmo arquivo com 'ignorar duplicados' não cria leads repetidos");
  it.todo("duplicado ENTRE lotes respeita a estratégia escolhida");
  it.todo("o relatório final mostra criados/atualizados/ignorados (com motivo)/erros por linha e permite baixar");
  it.todo("fechar o assistente durante o processamento pede confirmação e não perde o progresso");
});

describe("PLANEJADO — D-03 lead perdido", () => {
  it.todo("mover para etapa 'Perdido' pede confirmação (card e painel) e cancelar mantém a etapa original");
  it.todo("o motivo da perda é opcional e é enviado quando informado");
});

describe("PLANEJADO — D-01/D-09/D-13 sinais de atenção e indicadores", () => {
  it.todo("o card mostra 'atrasado', 'próxima ação' e 'parado há N dias' a partir dos campos agregados");
  it.todo("sem os campos agregados (backend antigo) o card se comporta como hoje");
  it.todo("o cabeçalho da etapa mostra o valor total; o tempo na etapa aparece como informação secundária");
  it.todo("lead com histórico incompleto de etapa é identificado como tal (D-13)");
});

describe("PLANEJADO — D-05 tipos de interação", () => {
  it.todo("o painel registra ligação/WhatsApp/e-mail/reunião e a timeline os exibe com ícone e autor");
});

describe("PLANEJADO — D-02/D-07/D-08 redesign do painel e do filtro de período", () => {
  it.todo("o filtro de período é rotulado 'Criados em'");
  it.todo("campos simples salvam inline com confirmação visual; erro volta ao valor anterior");
  it.todo("painel em coluna única com seções recolhíveis preserva o estado ao recolher/expandir");
});

describe("PLANEJADO — D-12 configurações da Equipe GSM", () => {
  it.todo("configurações internas ficam na área 'Equipe GSM', invisíveis para cliente comum");
  it.todo("sub-rotas de Configurações mantêm guardas e os links do onboarding");
});
