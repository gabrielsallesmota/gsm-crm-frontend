export type StageKey = "novo" | "contato" | "proposta" | "ganho" | "perdido";

export interface PipelineStage {
  id: StageKey;
  label: string;
  color: string;
}

export interface Pipeline {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  isDefault: boolean;
  active: boolean;
  stages: PipelineStage[];
}
