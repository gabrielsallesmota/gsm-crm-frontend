import { tasksService } from "../services/TasksService";
import type { CreateTaskInput, Task, UpdateTaskInput } from "../types/task";

export interface TaskActions {
  create(input: CreateTaskInput): Promise<Task>;
  update(taskId: string, input: UpdateTaskInput): Promise<Task>;
  setDone(taskId: string, done: boolean): Promise<Task>;
  delete(taskId: string): Promise<void>;
}

export function useTaskActions(): TaskActions {
  return {
    create: (input) => tasksService.create(input),
    update: (taskId, input) => tasksService.update(taskId, input),
    setDone: (taskId, done) => tasksService.update(taskId, { done }),
    delete: (taskId) => tasksService.delete(taskId),
  };
}
