import { tasksService } from "../services/TasksService";
import type { CreateTaskInput, Task } from "../types/task";

export interface TaskActions {
  toggle(taskId: string): Promise<Task>;
  create(input: CreateTaskInput): Promise<Task>;
  delete(taskId: string): Promise<void>;
}

export function useTaskActions(): TaskActions {
  return {
    toggle: (taskId) => tasksService.toggle(taskId),
    create: (input) => tasksService.create(input),
    delete: (taskId) => tasksService.delete(taskId),
  };
}
