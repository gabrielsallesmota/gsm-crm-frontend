import { operationsApiRepository } from "../repositories/api/OperationsApiRepository";
import type { CreateProcedureInput, Procedure, UpdateProcedureInput } from "../types/operations";

export class ProceduresService {
  list(onlyActive = false): Promise<Procedure[]> {
    return operationsApiRepository.listProcedures(onlyActive);
  }

  create(input: CreateProcedureInput): Promise<Procedure> {
    return operationsApiRepository.createProcedure(input);
  }

  update(id: string, input: UpdateProcedureInput): Promise<Procedure> {
    return operationsApiRepository.updateProcedure(id, input);
  }

  delete(id: string): Promise<void> {
    return operationsApiRepository.deleteProcedure(id);
  }
}

export const proceduresService = new ProceduresService();
