// Fixtures de CSV reproduzíveis (geradas em memória: nada é gravado em disco nem versionado).
import type { Page, Route } from "@playwright/test";
import { phoneOf } from "./api";

const quote = (cell: string): string => (/[",\n\r;]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(quote).join(",")).join("\n");
}

/** `n` linhas válidas "Nome,Telefone" com telefones únicos (prefixo identifica o cenário). */
export function validCsv(n: number, prefix: number, label = "Lead"): string {
  const rows = [["Nome", "Telefone"]];
  for (let i = 0; i < n; i++) rows.push([`${label} ${String(i).padStart(5, "0")}`, phoneOf(prefix, i)]);
  return toCsv(rows);
}

export const file = (content: string, name = "leads.csv") => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from(content, "utf8"),
});

export interface Held {
  index: number;
  status: number;
  /** Corpo devolvido pelo SERVIDOR REAL (o lote já foi gravado quando isto existe). */
  body: { created?: number; updated?: number; skipped?: number; errors?: number } | null;
  replayed: boolean;
  /** Entrega a resposta ao navegador. */
  release: () => Promise<void>;
}

/**
 * Segura a RESPOSTA de cada lote até o teste liberar: a requisição VAI ao servidor real (que grava
 * e confirma), mas o navegador só a recebe quando `release()` roda. Prova que o progresso da tela
 * acompanha o que o servidor confirmou — sem temporizador simulado.
 */
export async function holdBatches(page: Page) {
  let count = 0;
  const queue: Held[] = [];
  const waiters: ((held: Held) => void)[] = [];
  const handler = async (route: Route) => {
    const response = await route.fetch();
    const body = (await response.json().catch(() => null)) as Held["body"];
    const held: Held = {
      index: count++,
      status: response.status(),
      body,
      replayed: response.headers()["idempotent-replayed"] === "true",
      release: () => route.fulfill({ response }),
    };
    const waiter = waiters.shift();
    if (waiter) waiter(held);
    else queue.push(held);
  };
  await page.route("**/api/v1/leads/bulk-import", handler);
  return {
    next: (): Promise<Held> => {
      const ready = queue.shift();
      return ready ? Promise.resolve(ready) : new Promise<Held>((resolve) => waiters.push(resolve));
    },
    stop: async () => page.unroute("**/api/v1/leads/bulk-import", handler),
  };
}

export type BatchFault =
  | { kind: "status"; status: number; body?: unknown; headers?: Record<string, string> } // nunca chega ao servidor
  | { kind: "abort-before" } // conexão cai ANTES de chegar ao servidor
  | { kind: "abort-after" } // o servidor GRAVA e confirma, mas a resposta se perde (timeout)
  | { kind: "pass" };

/**
 * Injeta falhas por tentativa: `plan(attemptNumber, batchKey)` decide o que acontece com cada
 * requisição de lote (1ª, 2ª, … tentativa do conjunto todo). Registra o que o servidor respondeu.
 */
export async function injectFaults(page: Page, plan: (attempt: number, key: string) => BatchFault) {
  const log: { attempt: number; key: string; fault: string; serverStatus?: number; replayed?: boolean }[] = [];
  let attempt = 0;
  const handler = async (route: Route) => {
    const n = ++attempt;
    const key = route.request().headers()["idempotency-key"] ?? "";
    const fault = plan(n, key);
    if (fault.kind === "status") {
      log.push({ attempt: n, key, fault: `status-${fault.status}` });
      await route.fulfill({
        status: fault.status,
        contentType: "application/json",
        headers: fault.headers ?? {},
        body: JSON.stringify(fault.body ?? { detail: `falha simulada ${fault.status}` }),
      });
    } else if (fault.kind === "abort-before") {
      log.push({ attempt: n, key, fault: "abort-before" });
      await route.abort("connectionreset");
    } else if (fault.kind === "abort-after") {
      const response = await route.fetch();
      log.push({ attempt: n, key, fault: "abort-after", serverStatus: response.status() });
      await route.abort("connectionreset");
    } else {
      const response = await route.fetch();
      log.push({
        attempt: n,
        key,
        fault: "pass",
        serverStatus: response.status(),
        replayed: response.headers()["idempotent-replayed"] === "true",
      });
      await route.fulfill({ response });
    }
  };
  await page.route("**/api/v1/leads/bulk-import", handler);
  return { log, stop: async () => page.unroute("**/api/v1/leads/bulk-import", handler) };
}
