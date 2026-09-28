import type { TasksRepository } from "../repositories/TasksRepository";
import { TasksApiRepository } from "../repositories/api/TasksApiRepository";
import { TasksMockRepository } from "../repositories/mock/TasksMockRepository";
import { selectRepository } from "./factory";

/** Repasse direto ao repositório do modo atual (API real ou demonstração)
 * — a interface `TasksRepository` é o contrato. */
export const tasksService: TasksRepository = selectRepository(
  () => new TasksMockRepository(),
  () => new TasksApiRepository(),
);
