import { usersService } from "../services/UsersService";
import type { DirectoryMember } from "../types/user";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

/** Membros ATIVOS da equipe (nome + papel) — seletor de responsável e
 * filtro por dono. Disponível para qualquer papel. */
export function useTeamDirectory(): AsyncResourceState<DirectoryMember[]> {
  const { currentTenantId } = useAuth();
  return useAsyncResource(() => usersService.directory(), [currentTenantId]);
}
