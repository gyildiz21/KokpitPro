import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    clearGithubInstallationTokenCacheForTests,
    GithubVerificationError,
    indexGithubProject,
    validateGithubPlanPath,
} from '../github';

type AuthEnvKey =
    | 'GITHUB_APP_ID'
    | 'GITHUB_APP_INSTALLATION_ID'
    | 'GITHUB_APP_PRIVATE_KEY'
    | 'GITHUB_APP_PRIVATE_KEY_PATH'
    | 'GITHUB_TOKEN';

const AUTH_ENV_KEYS: readonly AuthEnvKey[] = [
    'GITHUB_APP_ID',
    'GITHUB_APP_INSTALLATION_ID',
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_APP_PRIVATE_KEY_PATH',
    'GITHUB_TOKEN',
];

const SECRET_LIKE_MARKERS = [/ghp_[A-Za-z0-9]/, /github_pat_[A-Za-z0-9_]/, /BEGIN (?:RSA )?PRIVATE KEY/, /Bearer\s+\S/];

function assertNoSecretLikeText(value: string): void {
    for (const marker of SECRET_LIKE_MARKERS) expect(marker.test(value), `secret-like text leaked: ${value}`).toBe(false);
}

interface RecordedRequest {
    url: string;
    headers: Record<string, string>;
}

interface FakeResponseSpec {
    status: number;
    body: unknown;
    headers?: Record<string, string>;
}

function fakeFetch(responses: FakeResponseSpec[], requests: RecordedRequest[]) {
    const impl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const headers = Object.fromEntries(
            Object.entries((init?.headers ?? {}) as Record<string, string>).map(([key, value]) => [key.toLowerCase(), value]),
        );
        requests.push({ url: String(input), headers });
        const spec = responses.shift();
        if (!spec) throw new Error(`unexpected extra fetch call: ${input}`);
        return new Response(JSON.stringify(spec.body), {
            status: spec.status,
            headers: { 'Content-Type': 'application/json', ...(spec.headers ?? {}) },
        });
    };
    return impl as unknown as typeof fetch;
}

const PRIVATE_REPO_404: FakeResponseSpec = { status: 404, body: { message: 'Not Found', documentation_url: 'https://docs.github.com/rest' } };

describe('GitHub negatif yol — anonim özel depo 404 dürüst hata sözleşmesi', () => {
    let authSnapshot: Array<readonly [AuthEnvKey, string | undefined]> = [];

    beforeEach(() => {
        authSnapshot = AUTH_ENV_KEYS.map((key) => [key, process.env[key]] as const);
        for (const key of AUTH_ENV_KEYS) delete process.env[key];
        clearGithubInstallationTokenCacheForTests();
    });

    afterEach(() => {
        for (const [key, value] of authSnapshot) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        clearGithubInstallationTokenCacheForTests();
    });

    it('özel depo anonim 404 → not-found-or-private, dürüst ve sır-sız mesaj', async () => {
        const requests: RecordedRequest[] = [];
        const fetchImpl = fakeFetch([PRIVATE_REPO_404], requests);
        const rejection = await indexGithubProject({ repository: 'gyildiz21/KokpitPro' }, undefined, { fetchImpl }).then(
            () => null,
            (error: unknown) => error,
        );
        expect(rejection).toBeInstanceOf(GithubVerificationError);
        const verification = rejection as GithubVerificationError;
        expect(verification.status).toBe(404);
        expect(verification.reasonCode).toBe('not-found-or-private');
        expect(verification.message).toContain('private or does not exist');
        expect(verification.message).toContain('GitHub App authorization is required');
        assertNoSecretLikeText(verification.message);
        // Anonim modda Authorization başlığı hiç gönderilmez.
        for (const request of requests) expect(request.headers).not.toHaveProperty('authorization');
    });

    it('401 → auth-required; 403/429 limit → rate-limit + retry; 403 sıradan → auth-required', async () => {
        const cases: Array<{ spec: FakeResponseSpec; expected: GithubVerificationError['reasonCode']; expectedStatus: number; retryAfter?: string }> = [
            { spec: { status: 401, body: { message: 'Bad credentials' } }, expected: 'auth-required', expectedStatus: 401 },
            {
                spec: { status: 403, body: {}, headers: { 'x-ratelimit-remaining': '0' } },
                expected: 'rate-limit',
                expectedStatus: 403,
            },
            {
                spec: { status: 429, body: {}, headers: { 'retry-after': '60' } },
                expected: 'rate-limit',
                expectedStatus: 429,
                retryAfter: '60',
            },
            { spec: { status: 403, body: {} }, expected: 'auth-required', expectedStatus: 403 },
        ];
        for (const single of cases) {
            const requests: RecordedRequest[] = [];
            const fetchImpl = fakeFetch([single.spec], requests);
            const rejection = await indexGithubProject({ repository: 'octocat/Hello-World' }, undefined, { fetchImpl }).then(
                () => null,
                (error: unknown) => error,
            );
            expect(rejection).toBeInstanceOf(GithubVerificationError);
            const verification = rejection as GithubVerificationError;
            expect(verification.reasonCode).toBe(single.expected);
            expect(verification.status).toBe(single.expectedStatus);
            expect(verification.retryAfter).toBe(single.retryAfter);
            assertNoSecretLikeText(verification.message);
        }
    });

    it('plan yolu traversal, mutlak yol ve ters bölü işaretini kabul etmez', () => {
        expect(validateGithubPlanPath('docs/PLAN.md')).toBe('docs/PLAN.md');
        for (const path of ['../PLAN.md', '/PLAN.md', 'C:\\PLAN.md', 'docs\\PLAN.md', '']) {
            expect(() => validateGithubPlanPath(path), path).toThrow(/repository-relative/);
        }
    });

    it('GitHub App kurulumu özel depoyu contents:read ile indeksler ve kurulum tokenını yeniden kullanır', async () => {
        const { privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        process.env.GITHUB_APP_ID = '12345';
        process.env.GITHUB_APP_INSTALLATION_ID = '67890';
        process.env.GITHUB_APP_PRIVATE_KEY = privateKey;
        let tokenCalls = 0;
        const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
            const url = String(input);
            const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([key, value]) => [key.toLowerCase(), value]));
            expect(headers['x-github-api-version']).toBe('2026-03-10');
            if (url.endsWith('/app/installations/67890/access_tokens')) {
                tokenCalls += 1;
                expect(headers.authorization).toMatch(/^Bearer [^.]+\.[^.]+\.[^.]+$/);
                expect(JSON.parse(String(init?.body))).toEqual({ repositories: ['KokpitPro'], permissions: { contents: 'read' } });
                return new Response(JSON.stringify({ token: 'installation-token-for-test', expires_at: '2099-01-01T00:00:00.000Z' }), {
                    status: 201,
                    headers: { 'content-type': 'application/json' },
                });
            }
            expect(headers.authorization).toBe('Bearer installation-token-for-test');
            if (/\/repos\/gyildiz21\/KokpitPro$/.test(url)) {
                return Response.json({ name: 'KokpitPro', default_branch: 'main', html_url: 'https://github.com/gyildiz21/KokpitPro', private: true });
            }
            if (url.includes('/commits/main')) return Response.json({ sha: 'b'.repeat(40) });
            if (url.includes('/contents/PLAN.md?ref=main')) return new Response('# Plan\n\n## Dilim 1\n\n- [ ] **Başla**\n');
            if (url.includes('/contents?ref=main')) return Response.json([{ name: 'src', path: 'src', type: 'dir' }]);
            throw new Error(`unexpected URL: ${url}`);
        }) as typeof fetch;

        const first = await indexGithubProject({ repository: 'gyildiz21/KokpitPro', planPath: 'PLAN.md' }, undefined, { fetchImpl });
        const second = await indexGithubProject({ repository: 'gyildiz21/KokpitPro', planPath: 'PLAN.md' }, first, { fetchImpl });
        expect(first.authMode).toBe('github-app');
        expect(first.source).toMatchObject({ type: 'github', private: true });
        expect(first.index.commit).toBe('b'.repeat(40));
        expect(second.id).toBe(first.id);
        expect(tokenCalls).toBe(1);
    });

    it('ağ erişilemez → status 0 network; hata metni platform yolu taşımaz', async () => {
        const networkFailure = (async (): Promise<Response> => {
            throw new TypeError('fetch failed');
        }) as unknown as typeof fetch;
        const rejection = await indexGithubProject({ repository: 'octocat/Hello-World' }, undefined, { fetchImpl: networkFailure }).then(
            () => null,
            (error: unknown) => error,
        );
        expect(rejection).toBeInstanceOf(GithubVerificationError);
        const verification = rejection as GithubVerificationError;
        expect(verification.status).toBe(0);
        expect(verification.reasonCode).toBe('network');
        expect(verification.message).not.toContain('fetch failed');
    });

    it('halka açık depoda plan dosyası hiç yoksa plan-file-missing dürüst kodu döner', async () => {
        const requests: RecordedRequest[] = [];
        const fetchImpl = fakeFetch(
            [
                { status: 200, body: { name: 'Hello-World', default_branch: 'main', html_url: 'https://github.com/octocat/Hello-World', private: false } },
                { status: 200, body: { sha: 'a'.repeat(40) } },
                PRIVATE_REPO_404,
                PRIVATE_REPO_404,
                PRIVATE_REPO_404,
                PRIVATE_REPO_404,
                PRIVATE_REPO_404,
                PRIVATE_REPO_404,
            ],
            requests,
        );
        const rejection = await indexGithubProject({ repository: 'octocat/Hello-World' }, undefined, { fetchImpl }).then(
            () => null,
            (error: unknown) => error,
        );
        expect(rejection).toBeInstanceOf(GithubVerificationError);
        const verification = rejection as GithubVerificationError;
        expect(verification.reasonCode).toBe('plan-file-missing');
        expect(verification.status).toBe(404);
    });
});

/**
 * Gerçek-API negatif turu — ayrı kapı, ortam korumalı (KOKPIT_REAL_GITHUB_PROBE=1).
 * Yalnız api.github.com READ çağrısı; kimlik env'leri geçici silinir ve restore edilir.
 * Hedef: gyildiz21/KokpitPro gerçekten özel depodur; anonim istek 404 alır.
 */
const RUN_REAL = process.env.KOKPIT_REAL_GITHUB_PROBE === '1';

describe.skipIf(!RUN_REAL)('gerçek API negatif turu — gyildiz21/KokpitPro özel depo', () => {
    it("anonim istek gerçek GitHub API'sinden 404 not-found-or-private alır", async () => {
        const snapshot = AUTH_ENV_KEYS.map((key) => [key, process.env[key]] as const);
        for (const key of AUTH_ENV_KEYS) delete process.env[key];
        try {
            const rejection = await indexGithubProject({ repository: 'gyildiz21/KokpitPro' }).then(
                (record) => record,
                (error: unknown) => error,
            );
            expect(rejection).toBeInstanceOf(GithubVerificationError);
            const verification = rejection as GithubVerificationError;
            expect(verification.status).toBe(404);
            expect(verification.reasonCode).toBe('not-found-or-private');
        } finally {
            for (const [key, value] of snapshot) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
        }
    });
});
