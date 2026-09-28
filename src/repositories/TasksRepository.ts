import type { Page } from "../types/common";
import type { CreateTaskInput, Task, TaskListQuery, UpdateTaskInput } from "../types/task";

export interface TasksRepository {
  list(query: TaskListQuery): Promise<Page<Task>>;
  create(input: CreateTaskInput): Promise<Task>;
  update(taskId: string, input: UpdateTaskInput): Promise<Task>;
  delete(taskId: string): Promise<void>;
}
