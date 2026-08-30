import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Dilim 2.1 · GitHub bağlantı negatif-yol kabulü.
 *
 * S1/S2 hermetiktir: api.github.com'a ÇIKILMAZ, yalnız aynı-köken API
 * route-maskelenir. S3 anonim gerçek-API negatif turudur ve yalnız
 * KOKPIT_REAL_GITHUB_PROBE=1 ile koşar. S4 ise gerçek GitHub App kurulumuyla
 * özel repo pozitif yolunu; açıkça yönlendirilmiş, yalıtılmış
 * KOKPIT_DATA_DIR içinde Doğrula → İndeksle → Hazır olarak kanıtlar.
 */

const PRIVATE_REPO = 'gyildiz21/KokpitPro';
const PUBLIC_REPO = 'octocat/Hello-World';
const FAKE_COMMIT = 'a'.repeat(40);

function githubRecordFixture(id: string, name: string) {
    return {
        id,
        name,
        source: { type: 'github', owner: 'octocat', repo: 'Hello-World', htmlUrl: 'https://github.com/octocat/Hello-World', private: false },
        branch: 'main',
        authMode: 'anonymous',
        connectionState: 'ready',
        index: {
            indexedAt: '2026-08-27T09:00:00.000Z',
            commit: FAKE_COMMIT,
            branch: 'main',
            revisionKind: 'commit',
            revision: FAKE_COMMIT,
            planPath: 'PLAN.md',
            planMarkdown: '# Plan\n\n## Dilim 1\n\n- [x] **Örnek madde** — hermetik maskeli kabul kaydı\n',
            groups: [],
            summary: { phaseCount: 1, itemCount: 1, doneCount: 1, partialCount: 0, openCount: 0 },
            nodes: [],
        },
        createdAt: '2026-08-27T09:00:00.000Z',
        updatedAt: '2026-08-27T09:00:00.000Z',
        lastError: null,
    };
}

function registryFixture(records: unknown[]) {
    return { version: 1, activeProjectId: records[0] ? (records[0] as { id: string }).id : null, projects: records };
}

async function openCatalog(page: Page): Promise<void> {
    await page.goto('/arayuz-onizleme.html');
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true', { timeout: 90_000 });
}

async function openGithubConnect(page: Page, repository: string): Promise<void> {
    await page.locator('#addProject').click();
    await page.locator('[data-connect-source="github"]').click();
    await page.locator('#githubRepoInput').fill(repository);
}

async function catalogRowCount(page: Page): Promise<number> {
    return page.locator('[data-project-row]').count();
}

test('S1 · anonim özel depo: doğrulama reddedilir, katalog hazır-gibi kaydetmez', async ({ page }) => {
    await openCatalog(page);
    const rowsBefore = await catalogRowCount(page);

    await page.route('**/api/projects/verify/github', (route: Route) =>
        route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
                error: `GitHub repository not found (404): ${PRIVATE_REPO} is private or does not exist. Anonymous access cannot verify private repositories; GitHub App authorization is required.`,
                code: 'github-not-found-or-private',
            }),
        }),
    );

    await openGithubConnect(page, PRIVATE_REPO);
    await page.locator('#connectNext').click();

    const alert = page.locator('#connectError');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('404');
    await expect(alert).toContainText('private or does not exist');
    await expect(alert).toContainText('GitHub App');
    // Akış Doğrula adımında kalır; Kaynak→Doğrula→İndeksle→Hazır atlanmaz.
    await expect(page.locator('.connect-step.is-current')).toHaveAttribute('data-step', '2');
    await page.locator('#connectCancel').click();
    await expect(page.locator('#connectDialog')).not.toBeVisible();
    expect(await catalogRowCount(page)).toBe(rowsBefore);
    // Başarısız doğrulama, özel repo kimliğiyle kayıt ÜRETMEZ (var olan yerel
    // "KokpitPro" kaydıyla karışmaz; konum metni farklıdır).
    await expect(page.locator('[data-project-row]').filter({ hasText: 'gyildiz21/KokpitPro' })).toHaveCount(0);
});

test('S2 · halka açık depo akışı regreasyonsuz: Doğrula → İndeksle → Hazır (maskeli)', async ({ page }) => {
    await openCatalog(page);
    const record = githubRecordFixture('github-hermetic-fixture', 'Hello Fixture');

    await page.route('**/api/projects/verify/github', (route: Route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record) }),
    );
    await page.route('**/api/projects/github', (route: Route) => {
        void route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(registryFixture([record])) });
    });
    await page.route('**/api/projects', (route: Route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(registryFixture([record])) }),
    );

    await openGithubConnect(page, PUBLIC_REPO);
    await page.locator('#connectNext').click();
    await expect(page.locator('.connect-step.is-current')).toHaveAttribute('data-step', '3');
    await expect(page.locator('#connectBody')).toContainText('doğrulandı');
    await page.locator('#connectNext').click();
    await expect(page.locator('.connect-step.is-current')).toHaveAttribute('data-step', '4');
    await expect(page.locator('#connectBody')).toContainText(/Kalıcı proje kaydı hazır|Persistent project record ready/);
    await page.locator('#connectCancel').click();
    await expect(page.locator('#connectDialog')).not.toBeVisible();
});

const RUN_REAL = process.env.KOKPIT_REAL_GITHUB_PROBE === '1';
const RUN_REAL_APP = process.env.KOKPIT_REAL_GITHUB_APP_PROBE === '1' && Boolean(process.env.KOKPIT_DATA_DIR);

test('S3 · gerçek API negatif turu: özel depo anonim → HTTP 404, kayıt defteri değişmez', async ({ request }) => {
    test.skip(!RUN_REAL, 'KOKPIT_REAL_GITHUB_PROBE=1 ile koşulur: gerçek api.github.com READ turu.');
    const before = await (await request.get('/api/projects')).json();
    const response = await request.post('/api/projects/verify/github', { data: { repository: PRIVATE_REPO } });
    const bodyText = await response.text();
    expect(response.status()).toBe(404);
    expect(bodyText).toContain('404');
    expect(bodyText).toContain('private or does not exist');
    const after = await (await request.get('/api/projects')).json();
    expect(after.projects.length).toBe(before.projects.length);
    // Başarısız doğrulama GitHub kimliğiyle kayıt üretmez (yerel KokpitPro
    // kaydı meşrudur; sahibi gyildiz21 olan GITHUB kaydı asla oluşmamalı).
    expect(after.projects.some((project: { source: { type: string; owner?: string; repo?: string } }) =>
        project.source.type === 'github' && project.source.owner === 'gyildiz21' && project.source.repo === 'KokpitPro',
    )).toBe(false);
});

test('S4 · kimlikli GitHub App pozitif turu: özel repo Doğrula → İndeksle → Hazır', async ({ page, request }) => {
    test.skip(
        !RUN_REAL_APP,
        'KOKPIT_REAL_GITHUB_APP_PROBE=1 ve yalıtılmış KOKPIT_DATA_DIR ile koşulur.',
    );

    const health = await request.get('/api/health');
    expect(health.ok()).toBe(true);
    expect((await health.json()).github).toEqual({ mode: 'github-app', configured: true });

    const before = await (await request.get('/api/projects')).json() as {
        projects: Array<{ id: string; source: { type: string; owner?: string; repo?: string } }>;
    };
    const matchesPrivateRepo = (project: { source: { type: string; owner?: string; repo?: string } }) =>
        project.source.type === 'github' && project.source.owner === 'gyildiz21' && project.source.repo === 'KokpitPro';
    expect(before.projects.some(matchesPrivateRepo), 'Yalıtılmış veri dizini boş bir GitHub kabul kaydıyla başlamalıdır.').toBe(false);

    let createdProjectId: string | null = null;
    try {
        await openCatalog(page);
        await openGithubConnect(page, PRIVATE_REPO);
        await page.locator('#connectNext').click();
        await expect(page.locator('.connect-step.is-current')).toHaveAttribute('data-step', '3');
        await expect(page.locator('#connectBody')).toContainText(/doğrulandı|verified/i);

        await page.locator('#connectNext').click();
        await expect(page.locator('.connect-step.is-current')).toHaveAttribute('data-step', '4');
        await expect(page.locator('#connectBody')).toContainText(/Kalıcı proje kaydı hazır|Persistent project record ready/);

        const after = await (await request.get('/api/projects')).json() as {
            projects: Array<{
                id: string;
                authMode: string;
                connectionState: string;
                branch: string;
                source: { type: string; owner?: string; repo?: string; private?: boolean };
                index?: { commit?: string; planPath?: string };
            }>;
        };
        const privateProject = after.projects.find(matchesPrivateRepo);
        expect(privateProject).toBeDefined();
        createdProjectId = privateProject?.id ?? null;
        expect(privateProject).toMatchObject({
            authMode: 'github-app',
            connectionState: 'ready',
            branch: 'main',
            source: { type: 'github', owner: 'gyildiz21', repo: 'KokpitPro', private: true },
        });
        expect(privateProject?.index?.commit).toMatch(/^[0-9a-f]{40}$/);
        expect(privateProject?.index?.planPath).toBe('PLAN.md');
    } finally {
        if (createdProjectId) {
            const cleanup = await request.delete(`/api/projects/${encodeURIComponent(createdProjectId)}`);
            expect(cleanup.ok()).toBe(true);
        }
    }
});
