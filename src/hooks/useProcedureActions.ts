import { proceduresService } from "../services/ProceduresService";
import type { CreateProcedureInput, Procedure, UpdateProcedureInput } from "../types/operations";

export interface ProcedureActions {
  create(input: CreateProcedureInput): Promise<Procedure>;
  update(id: string, input: UpdateProcedureInput): Promise<Procedure>;
  delete(id: string): Promise<void>;
}

export function useProcedureActions(): ProcedureActions {
  return {
    create: (input) => proceduresService.create(input),
    update: (id, input) => proceduresService.update(id, input),
    delete: (id) => proceduresService.delete(id),
  };
}
