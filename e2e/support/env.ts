// Constantes do ambiente E2E isolado (ver playwright.config.ts). Sem segredos versionados.
export const API = "http://127.0.0.1:8110";
export const WEB = "http://localhost:5174";

import type { TestInfo } from "@playwright/test";

export type Role = "admin" | "gestor" | "vendedor";

export function password(): string {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD ausente: rode via `npm run e2e` (o config gera a senha).");
  return value;
}

/** Usuários semeados por `scripts/e2e_backend.py`: tenant tNN, papéis admin/gestor/vendedor. */
export const email = (tenant: number, role: Role): string =>
  `t${String(tenant).padStart(2, "0")}-${role}@example.com`;

/** Cada teste usa o SEU tenant (dados isolados e reproduzíveis). Faixas por projeto: Chromium 1–150,
 * Firefox 151–250, WebKit 251–350 (testes `@cross` usam números ≤ 100 e rodam nos 3 navegadores sem se
 * atropelar). Números por arquivo: pipeline 3–23 · importação 24–59 · acessibilidade/visual 61–84 ·
 * segurança 85–96 · evidências visuais do redesign 101–110. */
export function tenantOf(testInfo: TestInfo, n: number): number {
  const base = { chromium: 0, firefox: 150, webkit: 250 }[testInfo.project.name] ?? 0;
  const max = base === 0 ? 150 : 100;
  if (n < 1 || n > max) throw new Error(`tenant ${n} fora da faixa (1–${max})`);
  return base + n;
}
