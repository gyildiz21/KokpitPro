import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = 43_217;
const origin = `http://127.0.0.1:${port}`;
const password = 'production-smoke-password-123';
const authorization = `Basic ${Buffer.from(`kokpit:${password}`).toString('base64')}`;
const dataDir = await mkdtemp(join(tmpdir(), 'kokpit-production-smoke-'));
const output = [];

const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: root,
    env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        KOKPIT_DEPLOYMENT_MODE: 'cloud',
        KOKPIT_PUBLIC_ORIGIN: origin,
        KOKPIT_ACCESS_PASSWORD: password,
        KOKPIT_DATA_DIR: dataDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => output.push(chunk.toString()));
child.stderr.on('data', (chunk) => output.push(chunk.toString()));

async function request(path, init) {
    return fetch(`${origin}${path}`, init);
}

async function waitForHealth() {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`Server exited early (${child.exitCode}).\n${output.join('')}`);
        try {
            const response = await request('/api/health');
            if (response.ok) return response;
        } catch {
            // Server is still starting.
        }
        await new Promise((resolveWait) => setTimeout(resolveWait, 150));
    }
    throw new Error(`Production server did not become healthy.\n${output.join('')}`);
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

try {
    const health = await waitForHealth();
    const healthBody = await health.json();
    assert(healthBody.ok === true && healthBody.mode === 'cloud', 'Health response must declare cloud readiness.');
    assert(!('persistence' in healthBody), 'Health response must not expose persistence paths.');

    const anonymous = await request('/arayuz-onizleme.html');
    assert(anonymous.status === 401, `Anonymous UI request must be 401, got ${anonymous.status}.`);
    assert(anonymous.headers.get('www-authenticate')?.startsWith('Basic '), 'Authentication challenge is missing.');

    const authenticated = await request('/arayuz-onizleme.html', { headers: { Authorization: authorization } });
    assert(authenticated.status === 200, `Authenticated UI request must be 200, got ${authenticated.status}.`);
    assert((await authenticated.text()).includes('KokpitPro'), 'Authenticated UI body is not KokpitPro.');

    const source = await request('/PLAN.md', { headers: { Authorization: authorization } });
    assert(source.status === 404, `Cloud source-file request must be 404, got ${source.status}.`);

    const localRoute = await request('/api/projects/local', {
        method: 'POST',
        headers: { Authorization: authorization, Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'C:/private/repo' }),
    });
    assert(localRoute.status === 403, `Cloud local-project route must be 403, got ${localRoute.status}.`);

    const crossOrigin = await request('/api/projects/active', {
        method: 'PUT',
        headers: { Authorization: authorization, Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'none' }),
    });
    assert(crossOrigin.status === 403, `Cross-origin mutation must be 403, got ${crossOrigin.status}.`);

    console.log('Production smoke passed: health, auth, source isolation, cloud route boundary, origin guard.');
} finally {
    if (child.exitCode === null) {
        child.kill('SIGTERM');
        await new Promise((resolveExit) => child.once('exit', resolveExit));
    }
    await rm(dataDir, { recursive: true, force: true });
}
