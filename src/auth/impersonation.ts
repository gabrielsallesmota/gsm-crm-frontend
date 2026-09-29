// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.
import type { AuthUser, ImpersonationInfo } from "../types/auth.ts";

/** Sessão de suporte (impersonation) — helpers puros, testados em
 * `tests/platform.test.ts`. */
export function isImpersonating(
  user: Pick<AuthUser, "impersonation"> | null | undefined,
): boolean {
  return Boolean(user?.impersonation);
}

export function isReadOnlySupport(info: ImpersonationInfo | null | undefined): boolean {
  return Boolean(info) && info?.mode !== "write";
}

/** Segundos restantes (nunca negativo). */
export function secondsLeft(expiresAt: string, now: Date = new Date()): number {
  const diff = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000);
  return Number.isFinite(diff) ? Math.max(0, diff) : 0;
}

/** "14:05" (mm:ss) ou "1h 02min" acima de uma hora. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
