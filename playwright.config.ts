// Testes E2E (Playwright) — complementam, não substituem, as suítes Node/Vitest.
//
// Ambiente ISOLADO: banco `gsm_crm_e2e` (Postgres local do docker-compose) recriado a cada execução
// por `gsm-crm-backend/scripts/e2e_backend.py`, API na porta 8110 e front (Vite) na 5174. Nunca
// aponta para dev nem produção. A senha dos usuários de teste é gerada AQUI a cada execução e
// repassada por variável de ambiente: nada de credencial é versionado.
//
//   npm run e2e                 # tudo (Chromium completo; Firefox/WebKit só o conjunto @cross)
//   npm run e2e -- --project=chromium
//   E2E_REUSE=1 npm run e2e     # reaproveita servidores já em pé (desenvolvimento)
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

process.env.E2E_PASSWORD ||= `E2e-${randomBytes(12).toString("base64url")}`;
const backendDir = process.env.GSM_BACKEND_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), "../gsm-crm-backend");
const reuse = process.env.E2E_REUSE === "1";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts/results",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["json", { outputFile: "e2e/.artifacts/report.json" }]],
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: /@cross/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: /@cross/ },
  ],
  webServer: [
    {
      command: "python scripts/e2e_backend.py --tenants 300 --port 8110",
      cwd: backendDir,
      url: "http://127.0.0.1:8110/health/live",
      timeout: 240_000,
      reuseExistingServer: reuse,
      env: { E2E_PASSWORD: process.env.E2E_PASSWORD },
    },
    {
      command: "npx vite --port 5174 --strictPort --host localhost",
      url: "http://localhost:5174",
      timeout: 120_000,
      reuseExistingServer: reuse,
      env: { VITE_CRM_API_URL: "http://127.0.0.1:8110", VITE_CRM_MODE: "api" },
    },
  ],
});
