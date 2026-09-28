import type { UsersRepository } from "../repositories/UsersRepository";
import { UsersApiRepository } from "../repositories/api/UsersApiRepository";
import { UsersMockRepository } from "../repositories/mock/UsersMockRepository";
import { selectRepository } from "./factory";

/** Repasse direto ao repositório do modo atual (API real ou demonstração)
 * — a interface `UsersRepository` é o contrato. */
export const usersService: UsersRepository = selectRepository(
  () => new UsersMockRepository(),
  () => new UsersApiRepository(),
);
