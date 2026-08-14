import { tasksService } from "../services/TasksService";
import type { Task } from "../types/task";

export interface TaskActions {
  toggle(taskId: string): Promise<Task>;
}

export function useTaskActions(): TaskActions {
  return {
    toggle: (taskId) => tasksService.toggle(taskId),
  };
}
