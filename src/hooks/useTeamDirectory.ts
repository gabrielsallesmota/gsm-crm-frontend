import { usersService } from "../services/UsersService";
import type { DirectoryMember } from "../types/user";
import { invalidateShared, sharedRequest } from "../utils/requestCache";
import { useAsyncResource, type AsyncResourceState } from "./useAsyncResource";
import { useAuth } from "./useAuth";

/** Membros ATIVOS da equipe (nome + papel) — seletor de responsável e
 * filtro por dono. Disponível para qualquer papel. Compartilhado entre
 * página, drawer e modais (uma requisição só). */
export function useTeamDirectory(): AsyncResourceState<DirectoryMember[]> {
  const { currentTenantId } = useAuth();
  const key = `team-directory:${currentTenantId ?? "-"}`;
  const resource = useAsyncResource(
    () => sharedRequest(key, () => usersService.directory()),
    [currentTenantId],
  );
  return {
    ...resource,
    reload: () => {
      invalidateShared(key);
      resource.reload();
    },
  };
}
