import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Dilim 2.1 · GitHub bağlantı negatif-yol kabulü.
 *
 * S1/S2 hermetiktir: api.github.com'a ÇIKILMAZ, yalnız aynı-köken API
 * route-maskelenir. S3 gerçek-API turu ayrı bir testtir ve yalnız
 * KOKPIT_REAL_GITHUB_PROBE=1 ile koşar (api.github.com READ izni); sunucunun
 * GithubVerificationError → HTTP 404 eşlemesi canlıyken anlamlıdır.
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
    expect(after.projects.some((project: { name: string }) => project.name === 'KokpitPro')).toBe(false);
});
