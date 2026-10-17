// Reinício REAL do backend durante uma importação. Só roda com `E2E_ALLOW_RESTART=1` e servidores
// já em pé (`E2E_REUSE=1`): o Playwright não deve ser o dono do processo que vamos derrubar.
//
//   E2E_REUSE=1 E2E_ALLOW_RESTART=1 npx playwright test e2e/restart.spec.ts --project=chromium
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { Api } from "./support/api";
import { chooseFile, importButton, importDialog, loginUi, openImport, openPipeline, stateText } from "./support/app";
import { file, validCsv } from "./support/csv";
import { API, tenantOf } from "./support/env";

const backendDir = process.env.GSM_BACKEND_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../gsm-crm-backend");

function killBackend(): void {
  spawnSync("powershell", [
    "-NoProfile",
    "-Command",
    "Get-NetTCPConnection -LocalPort 8110 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }",
  ]);
}

function startBackend(): void {
  const child = spawn("python", ["scripts/e2e_backend.py", "--keep-db", "--port", "8110"], {
    cwd: backendDir,
    env: { ...process.env },
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function waitHealthy(timeoutMs = 90_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(`${API}/health/live`)).ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("backend não voltou a tempo");
}

test.skip(process.env.E2E_ALLOW_RESTART !== "1", "só com E2E_ALLOW_RESTART=1 (derruba o processo da API)");

test("reiniciar o backend no meio da importação: 'Falhou', depois 'Retomar' conclui sem duplicar", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const tenant = tenantOf(testInfo, 58);
  const api = await Api.login(tenant);
  await loginUi(page, tenant);
  await openPipeline(page);
  await openImport(page);
  await chooseFile(page, file(validCsv(1500, 17)), 1500);
  await importDialog(page).getByLabel("Se o telefone já existir").selectOption("duplicate");
  let batch = 0;
  // no 2º lote, derruba o processo da API ANTES de a requisição seguir (queda real, não simulada)
  await page.route("**/api/v1/leads/bulk-import", async (route) => {
    batch++;
    if (batch === 2) killBackend();
    await route.continue().catch(() => route.abort());
  });
  await importButton(page).click();
  await expect(stateText(page, "Falhou")).toBeVisible({ timeout: 60_000 });
  await page.unroute("**/api/v1/leads/bulk-import");
  startBackend();
  await waitHealthy();
  const apiAfter = await Api.login(tenant);
  const persisted = await apiAfter.leadCount();
  expect(persisted).toBeGreaterThanOrEqual(500); // o lote 1 sobreviveu ao reinício (está no Postgres)
  expect(persisted).toBeLessThan(1500);
  await importDialog(page).getByRole("button", { name: "Retomar importação" }).click();
  await expect(stateText(page, "Concluído")).toBeVisible({ timeout: 120_000 });
  const leads = await apiAfter.leads();
  expect(leads).toHaveLength(1500);
  expect(new Set(leads.map((l) => l.phone)).size).toBe(1500);
  void api;
});
