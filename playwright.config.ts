import { defineConfig, devices } from '@playwright/test';

const frontendPort = 4174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'line',
  timeout: 120_000,
  expect: {
    timeout: 60_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${frontendPort}`,
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command:
      `VITE_API_ENDPOINT= VITE_PUBLIC_LOGIN_ENABLED=false ` +
      `bun run --cwd frontend start --mode test --host 127.0.0.1 ` +
      `--port ${frontendPort} --strictPort`,
    url: `http://127.0.0.1:${frontendPort}/catalog`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
