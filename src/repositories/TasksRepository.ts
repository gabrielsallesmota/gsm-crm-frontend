import type { Task } from "../types/task";

export interface TasksRepository {
  list(): Promise<Task[]>;
  toggle(taskId: string): Promise<Task>;
}
