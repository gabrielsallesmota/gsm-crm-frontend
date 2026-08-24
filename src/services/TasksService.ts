import type { TasksRepository } from "../repositories/TasksRepository";
import { TasksApiRepository } from "../repositories/api/TasksApiRepository";
import { TasksMockRepository } from "../repositories/mock/TasksMockRepository";
import { selectRepository } from "./factory";
import type { CreateTaskInput, Task } from "../types/task";

const repo: TasksRepository = selectRepository(
  () => new TasksMockRepository(),
  () => new TasksApiRepository(),
);

export class TasksService {
  list(): Promise<Task[]> {
    return repo.list();
  }

  toggle(taskId: string): Promise<Task> {
    return repo.toggle(taskId);
  }

  create(input: CreateTaskInput): Promise<Task> {
    return repo.create(input);
  }

  delete(taskId: string): Promise<void> {
    return repo.delete(taskId);
  }
}

export const tasksService = new TasksService();
