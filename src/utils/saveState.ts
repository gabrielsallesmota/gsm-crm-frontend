// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import { ApiError } from "../types/common.ts";
import { describeError } from "./apiErrors.ts";

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; message: string }
  | { kind: "conflict" }
  | { kind: "error"; message: string };

/** Falha de um "Salvar" → estado da tela. 409 é tratado à parte: outra
 * sessão mudou a configuração e NADA é sobrescrito. */
export function saveFailure(err: unknown, fallback: string): SaveState {
  if (err instanceof ApiError && err.status === 409) return { kind: "conflict" };
  return { kind: "error", message: describeError(err, fallback) };
}
