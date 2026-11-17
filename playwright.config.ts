import { defineConfig } from "@playwright/test";

// Por padrão testa o sistema publicado. Para testar local:
//   E2E_BASE_URL=http://127.0.0.1:5173 pnpm test:e2e
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://imobitec.netlify.app",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    locale: "pt-BR",
  },
});
