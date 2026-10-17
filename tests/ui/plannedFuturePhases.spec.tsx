// FASE 0 — cenários PLANEJADOS do frontend (`it.todo`): aparecem no relatório como pendentes e
// NUNCA como verdes. Cada um aponta a decisão (D-xx) ou fase que o ativa. Ver
// docs/ux-redesign/fase-0-testes/07_TESTES_FUTUROS.md.
import { describe, it } from "vitest";

// D-10 (importação em lotes) foi implementado na Fase 1B: cenários em leadImportModal.spec.tsx,
// tests/leadImport.test.ts e test_import_batches_and_sorting_1b.py.

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
