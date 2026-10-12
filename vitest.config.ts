import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// CRM-008 — testes de UI/integração com a API (jsdom). Convivem com os
// testes puros de `node --test` (`tests/**/*.test.ts`): aqui só entram os
// `*.spec.ts(x)` de `tests/ui`, que precisam de DOM, React e `import.meta.env`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/ui/**/*.spec.{ts,tsx}"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
