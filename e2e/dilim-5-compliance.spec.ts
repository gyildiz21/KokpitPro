import { expect, test, type Page, type Route } from '@playwright/test';

/*
 * Dilim 5 · Uyum Telemetrisi kabulü — HERMETİK: compliance API yolları
 * route-maskelenir; api.github.com'a çıkılmaz. Gerçek sunucu yalnız katalog
 * yükleme + diyagram iskeleti için çalışır (webServer). Mock rapor, donmuş
 * kokpit/check/schema.ts sözleşmesine birebir uyar.
 */

const MOCK_REPORT = {
    version: 1,
    projectId: 'local-859d21494b4a',
    generatedAt: new Date().toISOString(),
    measurement: 'measured',
    reasons: [],
    violations: [
        {
            id: 'hex-in-component:frontend-src-app-css:12',
            rule: 'hex-in-component',
            severity: 'error',
            state: 'open',
            targetPath: 'frontend/src/app.css',
            targetLine: 12,
            message: 'Hex color literal found outside the token registry; use --st-* design tokens only.',
            ruleReference: 'AGENTS/DESIGN: bileşende hex yasak; yalnız --st-* belirteçleri',
            contextFriction: 'low',
            changeCount: 0,
        },
        {
            id: 'bayat-kutu:plan-md:48',
            rule: 'bayat-kutu',
            severity: 'note',
            state: 'open',
            targetPath: 'PLAN.md',
            targetLine: 48,
            message: 'Plan item #7 was completed on 2026-01-01; the box has not been re-verified for over 30 days.',
            ruleReference: 'UI-SPEC §3.3: bayat veri (>7g) ayrı sinyal',
            contextFriction: 'low',
            changeCount: 0,
        },
    ],
    sync: [
        {
            sliceId: 'Dilim 5 · Uyum Telemetrisi',
            phaseFile: 'stale',
            roadmapBox: 'partial',
            handoff: 'partial',
            nearMiss: { reasonCode: 'date-gap', message: 'Latest phase-file signal predates the roadmap completion date by more than 7 days.' },
        },
    ],
    conflicts: [
        {
            id: 'conflict:test-topic',
            topic: 'korpus, tez',
            status: 'open-conflict',
            authorityA: 'ROADMAP.md · L37 — "…TR korpusu değildir…"',
            authorityB: '.agents/karar-defteri.md · L46 — D4-I · Korpus erişimi (2026-08-22)',
            observedAtA: '2026-07-28',
            observedAtB: '2026-08-22',
            suggestion: 'Add a superseded-note to the older authority line, or record this as an accepted conflict.',
        },
    ],
    health: { phaseDone: 50, partial: 2, open: 6, syncStale: 1, vioErr: 1, vioWarn: 0, conflictOpen: 1 },
};

const CLOSED_REPORT = {
    ...MOCK_REPORT,
    violations: [
        { ...MOCK_REPORT.violations[0], state: 'closed', closedAt: '2026-08-27T12:00:00.000Z', closedBy: 'patron', closureJustification: 'Token kayıt dosyasına taşındı; kural referansı güncellendi.' },
        MOCK_REPORT.violations[1],
    ],
    health: { ...MOCK_REPORT.health, vioErr: 0 },
};

async function openWorkspace(page: Page): Promise<void> {
    await page.goto('/arayuz-onizleme.html');
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true', { timeout: 90_000 });
    await expect(page.locator('#previewGenerated')).toContainText('projectId:');
}

async function openComplianceView(page: Page): Promise<void> {
    await page.locator('.primary-nav-button[data-section="workspace"]').click();
    await page.locator('#tab-compliance').click();
    await expect(page.locator('#view-compliance')).toBeVisible();
}

test('S1 · gerçek ihlal kartları görünür; ÖRNEK etiketi yoktur; sayaçlar sağlık bantlarından gelir', async ({ page }) => {
    await page.route('**/api/projects/**/compliance', (route: Route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: MOCK_REPORT }) }),
    );
    await openWorkspace(page);
    await openComplianceView(page);

    const rows = page.locator('#issueList .issue-row');
    await expect(rows).toHaveCount(4);
    await expect(rows.filter({ hasText: 'app.css' })).toHaveCount(1);
    await expect(rows.filter({ hasText: /Yükselen|Örnek/ })).toHaveCount(0);
    await expect(page.locator('#queueCountViolation')).toHaveText('2');
    await expect(page.locator('#queueCountSync')).toHaveText('1');
    await expect(page.locator('#queueCountDecision')).toHaveText('1');
    await expect(page.locator('#queueCountClosed')).toHaveText('0');
    await expect(page.locator('#signalViolationOpen')).toHaveText('1');
    await expect(page.locator('#signalDecisionOpen')).toHaveText('1');
    await expect(page.locator('#complianceEngineState')).toContainText(/Canlı uyum raporu|Live compliance report/);
});

test("S2 · çipten kanıta ≤2 tık: ihlal satırı → drawer da kanıt satırı (targetPath:line)", async ({ page }) => {
    await page.route('**/api/projects/**/compliance', (route: Route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: MOCK_REPORT }) }),
    );
    await page.route('**/api/projects/**/compliance/close', (route: Route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: CLOSED_REPORT }) }),
    );
    await openWorkspace(page);
    // 1. tık: sinyal çipi uyum görünümünü ilgili filtreyle açar (çip yalnız
    // çalışma alanı görünürken çizilir).
    await openComplianceView(page);
    await page.locator('.signal-link[data-compliance-filter="violation"]').click();
    await expect(page.locator('#view-compliance')).toBeVisible();
    await expect(page.locator('#issueList .issue-row').filter({ hasText: 'app.css' })).toBeVisible();
    // 2. tık: ihlal satırı kanıt drawer'ını açar.
    await page.locator('#issueList .issue-row').filter({ hasText: 'app.css' }).click();
    await expect(page.locator('#inspectorBody')).toContainText('frontend/src/app.css:12');
    await expect(page.locator('#inspectorBody')).toContainText(/Kural referansı|Rule reference/);
    await expect(page.locator('#inspectorBody')).toContainText('--st-*');
});

test("S3 · kapatma gerekçesiz ilerlemez; gerekçe ve rumuz ile kapanır; denetim bilgisi drawer da görünür", async ({ page }) => {
    const closeHandler = async (route: Route) => {
        const body = route.request().postDataJSON() as { violationId: string; justification: string; by: string };
        expect(body.justification.trim().length).toBeGreaterThan(0);
        expect(body.by.trim().length).toBeGreaterThan(0);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: CLOSED_REPORT }) });
    };
    await page.route('**/api/projects/**/compliance', (route: Route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: MOCK_REPORT }) }),
    );
    await page.route('**/api/projects/**/compliance/close', closeHandler);
    await openWorkspace(page);
    await openComplianceView(page);
    await page.locator('#issueList .issue-row').filter({ hasText: 'app.css' }).click();
    await expect(page.locator('#inspectorBody')).toContainText(/Gerekçe \(zorunlu\)|Justification \(required\)/);

    const save = page.locator('.closure-form button[type="submit"]');
    await expect(save).toBeDisabled();
    await page.locator('#closureJustification').fill('Token kayıt dosyasına taşındı; kural referansı güncellendi.');
    await expect(save).toBeDisabled();
    await page.locator('#closureBy').fill('patron');
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.locator('#inspectorBody')).toContainText(/Kapatma makbuzu|Closure receipt/);
    await expect(page.locator('#inspectorBody')).toContainText('patron');
    await expect(page.locator('#queueCountClosed')).toHaveText('1');
    await expect(page.locator('#queueCountViolation')).toHaveText('1');
    await page.locator('.queue-filter[data-queue-filter="closed"]').click();
    await expect(page.locator('#issueList .issue-row')).toHaveCount(1);
});

test('S4 · motor ölçemediğinde boş liste temiz gibi SUNULMAZ; ölçüm gerekçesi görünür', async ({ page }) => {
    await page.route('**/api/projects/**/compliance', (route: Route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                report: {
                    ...MOCK_REPORT,
                    measurement: 'unmeasured',
                    reasons: [{ code: 'no-local-checkout', message: 'Compliance rules measure local working trees.' }],
                    violations: [], sync: [], conflicts: [],
                    health: { phaseDone: 0, partial: 0, open: 0, syncStale: 0, vioErr: 0, vioWarn: 0, conflictOpen: 0 },
                },
            }),
        }),
    );
    await openWorkspace(page);
    await openComplianceView(page);
    await expect(page.locator('#complianceEngineState')).toContainText(/Motor ölçemedi|Engine could not measure/);
    await expect(page.locator('#complianceNote')).toBeVisible();
    await expect(page.locator('#complianceNote')).toContainText('no-local-checkout');
    await expect(page.locator('#issueList .issue-row')).toHaveCount(0);
    await expect(page.locator('#complianceEmpty')).toBeVisible();
    await expect(page.locator('#signalViolationOpen')).toHaveText('—');
});

test('S5 · TR/EN parite: uyum yüzeyi ve drawer tamamen çevrilir', async ({ page }) => {
    await page.route('**/api/projects/**/compliance', (route: Route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: MOCK_REPORT }) }),
    );
    await openWorkspace(page);
    await openComplianceView(page);
    await expect(page.locator('#complianceEngineState')).toContainText('Canlı uyum raporu');
    await page.locator('#langEn').click();
    await expect(page.locator('#complianceEngineState')).toContainText('Live compliance report');
    await page.locator('#issueList .issue-row').first().click();
    await expect(page.locator('#inspectorBody')).toContainText(/Evidence target|Technical message/);
    await expect(page.locator('.closure-form')).toContainText('Justification (required)');
    await page.locator('#langTr').click();
    await expect(page.locator('#inspectorBody')).toContainText('Kanıt hedefi');
});

test("S6 · klavye: 4 tuşu görünümü açar; satıra Tab ile ulaşılır; Esc drawer ı kapatır", async ({ page }) => {
    await page.route('**/api/projects/**/compliance', (route: Route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: MOCK_REPORT }) }),
    );
    await openWorkspace(page);
    await page.locator('.primary-nav-button[data-section="workspace"]').click();
    // Dar panel (≤1199px) deseninde açılış/Esc odak iadesi body sınıfıyla taşınır.
    await page.setViewportSize({ width: 1024, height: 820 });
    await page.keyboard.press('4');
    await expect(page.locator('#view-compliance')).toBeVisible();
    await expect(page.locator('#issueList .issue-row').first()).toBeVisible();
    await page.locator('#issueList .issue-row').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveClass(/inspector-open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/inspector-open/);
});

test('S7 · Regres/Yükselen nöbetçi dürüstlük: tıklama yargı üretmez, nedenini söyler', async ({ page }) => {
    await page.route('**/api/projects/**/compliance', (route: Route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: MOCK_REPORT }) }),
    );
    await openWorkspace(page);
    await openComplianceView(page);
    await page.locator('.queue-filter[data-queue-filter="regress"]').click();
    await expect(page.locator('#toast')).toContainText(/v1'de tutulmuyor|not kept in v1/);
    await expect(page.locator('#issueList .issue-row')).toHaveCount(4);
});

test("S8 · 1440-1024-768 genişliklerde uyum yüzeyi yatay taşmaz", async ({ page }) => {
    await page.route('**/api/projects/**/compliance', (route: Route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: MOCK_REPORT }) }),
    );
    await openWorkspace(page);
    await openComplianceView(page);
    for (const width of [1440, 1024, 768]) {
        await page.setViewportSize({ width, height: 820 });
        await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
});

test("S9 · canlı API sözleşmesi: GET compliance KokpitPro da ölçülmüş yapı döndürür (maskesiz)", async ({ request }) => {
    const registry = await (await request.get('/api/projects')).json();
    const kokpit = registry.projects.find((project: { name: string }) => project.name === 'KokpitPro');
    expect(kokpit).toBeTruthy();
    const response = await request.get(`/api/projects/${encodeURIComponent(kokpit.id)}/compliance`);
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.report.version).toBe(1);
    expect(payload.report.measurement).toBe('measured');
    expect(typeof payload.report.health.vioErr).toBe('number');
    expect(typeof payload.report.health.vioWarn).toBe('number');
    expect(payload.report.violations.every((violation: { id: string; state: string }) => typeof violation.id === 'string' && ['open', 'closed'].includes(violation.state))).toBe(true);
});
