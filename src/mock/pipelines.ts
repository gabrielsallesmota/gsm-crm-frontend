import type { Pipeline, PipelineStage } from "../types/pipeline";

type RawPipeline = Omit<Pipeline, "stages"> & { stages: Omit<PipelineStage, "order">[] };

/** Sementes da demonstração. Os ids de etapa ("novo", "contato"...) são só
 * dados de exemplo — viram ids únicos por pipeline abaixo (`p1-novo`), e a
 * UI trata etapa sempre pelo id real, nunca por um funil fixo. */
const rawPipelines: RawPipeline[] = [
  {
    id: "p1",
    tenantId: "c1",
    name: "Comercial",
    color: "#2ee66e",
    isDefault: true,
    active: true,
    stages: [
      { id: "novo", label: "Novo", color: "#4aa3ff", isWon: false, isLost: false },
      { id: "contato", label: "Em contato", color: "#f5b13d", isWon: false, isLost: false },
      { id: "proposta", label: "Proposta", color: "#a78bfa", isWon: false, isLost: false },
      { id: "ganho", label: "Ganho", color: "#2ee66e", isWon: true, isLost: false },
      { id: "perdido", label: "Perdido", color: "#9aa6b2", isWon: false, isLost: true },
    ],
  },
  {
    id: "p2",
    tenantId: "c1",
    name: "Pós-venda",
    color: "#4aa3ff",
    isDefault: false,
    active: true,
    stages: [
      { id: "novo", label: "Onboarding", color: "#4aa3ff", isWon: false, isLost: false },
      { id: "contato", label: "Ativo", color: "#2ee66e", isWon: false, isLost: false },
      { id: "proposta", label: "Renovação", color: "#a78bfa", isWon: false, isLost: false },
      { id: "ganho", label: "Fidelizado", color: "#2ee66e", isWon: true, isLost: false },
      { id: "perdido", label: "Churn", color: "#9aa6b2", isWon: false, isLost: true },
    ],
  },
  {
    id: "p3",
    tenantId: "c2",
    name: "Vendas Loja",
    color: "#4aa3ff",
    isDefault: true,
    active: true,
    stages: [
      { id: "novo", label: "Novo", color: "#4aa3ff", isWon: false, isLost: false },
      { id: "contato", label: "Em contato", color: "#f5b13d", isWon: false, isLost: false },
      { id: "proposta", label: "Carrinho", color: "#a78bfa", isWon: false, isLost: false },
      { id: "ganho", label: "Comprou", color: "#2ee66e", isWon: true, isLost: false },
      { id: "perdido", label: "Perdido", color: "#9aa6b2", isWon: false, isLost: true },
    ],
  },
  {
    id: "p4",
    tenantId: "c3",
    name: "Orçamentos",
    color: "#f5b13d",
    isDefault: true,
    active: true,
    stages: [
      { id: "novo", label: "Solicitado", color: "#4aa3ff", isWon: false, isLost: false },
      { id: "contato", label: "Visita", color: "#f5b13d", isWon: false, isLost: false },
      { id: "proposta", label: "Orçado", color: "#a78bfa", isWon: false, isLost: false },
      { id: "ganho", label: "Aprovado", color: "#2ee66e", isWon: true, isLost: false },
      { id: "perdido", label: "Recusado", color: "#9aa6b2", isWon: false, isLost: true },
    ],
  },
];

export const mockPipelines: Pipeline[] = rawPipelines.map((pipeline) => ({
  ...pipeline,
  stages: pipeline.stages.map((stage, index) => ({
    ...stage,
    id: `${pipeline.id}-${stage.id}`,
    order: index,
  })),
}));

/** Pipeline padrão de cada tenant de demonstração. */
export function defaultMockPipelineId(tenantId: string): string {
  const pipeline =
    mockPipelines.find((p) => p.tenantId === tenantId && p.isDefault) ??
    mockPipelines.find((p) => p.tenantId === tenantId);
  return pipeline?.id ?? "p1";
}
