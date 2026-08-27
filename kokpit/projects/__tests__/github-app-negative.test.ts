import { afterEach, describe, expect, it } from 'vitest';
import { GithubVerificationError, indexGithubProject } from '../github';

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
    afterEach(() => {
        installationTokenCacheClear();
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

    it('401 → auth-required eşlemesi; 403+limit → rate-limit; 403 sıradan → auth-required', async () => {
        const cases: Array<{ spec: FakeResponseSpec; expected: GithubVerificationError['reasonCode']; expectedStatus: number }> = [
            { spec: { status: 401, body: { message: 'Bad credentials' } }, expected: 'auth-required', expectedStatus: 401 },
            {
                spec: { status: 403, body: {}, headers: { 'x-ratelimit-remaining': '0' } },
                expected: 'rate-limit',
                expectedStatus: 403,
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
            assertNoSecretLikeText(verification.message);
        }
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

function installationTokenCacheClear(): void {
    // installationTokenCache modül içidir; testlerde App kimliği ayaksız kaldığından
    // dolum oluşmaz. Boş temizlik, gelecekteki sızıntı turları için nöbetçi iskelettir.
}
