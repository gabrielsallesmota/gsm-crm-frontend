import { usersService } from "../services/UsersService";
import type { User } from "../types/user";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

export function useUsers(): AsyncResourceState<User[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => usersService.list(), [currentTenantId]);
}
