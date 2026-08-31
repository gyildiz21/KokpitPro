import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

export function resolveE2eDataDir(
    configured = process.env.KOKPIT_DATA_DIR,
    temporaryRoot = tmpdir(),
    runId: string = randomUUID(),
): string {
    return configured || resolve(temporaryRoot, `kokpit-pro-e2e-${runId}`);
}

export function shouldReuseE2eServer(configured = process.env.KOKPIT_E2E_REUSE_SERVER): boolean {
    return configured === '1';
}

const requestedPort = Number.parseInt(process.env.KOKPIT_E2E_PORT || '4173', 10);
const e2ePort = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65_535
    ? requestedPort
    : 4173;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;
const e2eDataDir = resolveE2eDataDir();

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
        env: { PORT: String(e2ePort), KOKPIT_DATA_DIR: e2eDataDir },
        // Varsayılan koşum, kullanıcının canlı sunucusunu veya .kokpit/data
        // kaydını asla devralmaz. Teşhis amaçlı yeniden kullanım açık opt-in'dir.
        reuseExistingServer: shouldReuseE2eServer(),
        timeout: 120_000,
    },
});
