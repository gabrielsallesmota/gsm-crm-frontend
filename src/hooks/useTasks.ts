import { tasksService } from "../services/TasksService";
import type { Task } from "../types/task";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useTasks(): AsyncResourceState<Task[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => tasksService.list(), [currentTenantId]);
}
