import { defineConfig } from '@playwright/test';

const requestedPort = Number.parseInt(process.env.KOKPIT_E2E_PORT || '4173', 10);
const e2ePort = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65_535
    ? requestedPort
    : 4173;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    timeout: 120_000,
    expect: { timeout: 15_000 },
    use: {
        baseURL: e2eBaseUrl,
        colorScheme: 'dark',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run start',
        url: `${e2eBaseUrl}/api/health`,
        env: { PORT: String(e2ePort) },
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
