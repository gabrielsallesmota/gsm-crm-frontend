import type { CreateTaskInput, Task } from "../types/task";

export interface TasksRepository {
  list(): Promise<Task[]>;
  toggle(taskId: string): Promise<Task>;
  create(input: CreateTaskInput): Promise<Task>;
  delete(taskId: string): Promise<void>;
}
