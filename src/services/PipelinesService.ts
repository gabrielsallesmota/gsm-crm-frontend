import type { PipelinesRepository } from "../repositories/PipelinesRepository";
import { PipelinesApiRepository } from "../repositories/api/PipelinesApiRepository";
import { PipelinesMockRepository } from "../repositories/mock/PipelinesMockRepository";
import { selectRepository } from "./factory";

/** Repasse direto ao repositório do modo atual (API real ou demonstração)
 * — a interface `PipelinesRepository` é o contrato. */
export const pipelinesService: PipelinesRepository = selectRepository(
  () => new PipelinesMockRepository(),
  () => new PipelinesApiRepository(),
);
