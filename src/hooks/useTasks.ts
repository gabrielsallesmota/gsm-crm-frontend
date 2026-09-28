import { tasksService } from "../services/TasksService";
import type { Page } from "../types/common";
import type { Task, TaskListQuery } from "../types/task";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useTasks(query: TaskListQuery): AsyncResourceState<Page<Task>> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => tasksService.list(query), [JSON.stringify(query), currentTenantId]);
}
