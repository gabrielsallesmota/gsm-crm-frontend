import type { TasksRepository } from "../repositories/TasksRepository";
import { TasksApiRepository } from "../repositories/api/TasksApiRepository";
import { TasksMockRepository } from "../repositories/mock/TasksMockRepository";
import { CRM_MODE } from "./factory";
import type { Task } from "../types/task";

const repo: TasksRepository = CRM_MODE === "demo" ? new TasksMockRepository() : new TasksApiRepository();

export class TasksService {
  list(): Promise<Task[]> {
    return repo.list();
  }

  toggle(taskId: string): Promise<Task> {
    return repo.toggle(taskId);
  }
}

export const tasksService = new TasksService();
