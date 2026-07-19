import type { TasksRepository } from "../TasksRepository";
import type { Task } from "../../types/task";
import { NotImplementedError } from "../../utils/errors";

export class TasksApiRepository implements TasksRepository {
  async list(): Promise<Task[]> {
    throw new NotImplementedError("Tarefas");
  }

  async toggle(_taskId: string): Promise<Task> {
    throw new NotImplementedError("Tarefas");
  }
}
