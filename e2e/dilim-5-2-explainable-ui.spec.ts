import { expect, test, type Page, type Route } from '@playwright/test';

/*
 * Dilim 5.2 · Açıklanabilir arayüz kabulü — HERMETİK: tüm API yolları
 * route-maskelenir; api.github.com'a çıkılmaz. Mock rapor Dilim 5 spec'indeki
 * donmuş ComplianceReport şemasını, mock zarflar ExplanationEnvelope v1
 * sözleşmesini (UI-SPEC §10.9.2, DESIGN D8) birebir izler.
 */

const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const PHASE = 'Dilim 5.2 · Açıklanabilir Kokpit';
const TEST_PATH = 'kokpit/parser/__tests__/roadmap.test.ts';
const ITEM1_TEXT = '`kokpit/server.ts` kabulü';
const HEX_ID = 'hex-in-component:frontend-src-app-css:12';

function planMarkdown(): string {
    return [
        '# Mock Plan',
        '',
        `## ${PHASE}`,
        '',
        '- [x] **`kokpit/server.ts` kabulü**: gerçek makbuz eşleşmesi',
        '- [ ] **`kokpit/planlar/yeni-modul.ts` eklenecek**: yol henüz ölçülmedi',
        '',
        '- **Kabul:** kullanıcı yolculuğu iki dilde doğrulanır ve yatay taşma üretmez',
        '',
    ].join('\n');
}

function projectRecord() {
    return {
        id: 'mock-proj',
        name: 'Mock Proje',
        source: { type: 'local', root: 'C:/mock/mock-proj' },
        authMode: 'local',
        branch: 'main',
        connectionState: 'ready',
        lastError: null,
        index: {
            planPath: 'PLAN.md',
            planMarkdown: planMarkdown(),
            commit: COMMIT,
            revisionKind: 'commit',
            revision: COMMIT,
            indexedAt: '2026-08-31T08:00:00.000Z',
            summary: { phaseCount: 1, itemCount: 2 },
            groups: [{
                heading: PHASE,
                gateStatus: null,
                line: 3,
                items: [
                    { id: 'madde-1', title: '`kokpit/server.ts` kabulü', status: 'done', phaseHeading: PHASE, line: 5 },
                    { id: 'madde-2', title: '`kokpit/planlar/yeni-modul.ts` eklenecek', status: 'open', phaseHeading: PHASE, line: 6 },
                ],
            }],
            nodes: [
                { id: 'n_server', title: 'server.ts', path: 'kokpit/server.ts', status: 'done', evidence: 'plan-path-match' },
                { id: 'n_parser', title: 'parser.ts', path: 'kokpit/parser/parser.ts', status: 'partial', evidence: 'measured-import' },
            ],
        },
    };
}

function diagramPayload(projectId = 'mock-proj') {
    const receiptEvidence = {
        projectId,
        branch: 'main',
        commit: COMMIT,
        revisionKind: 'commit',
        revision: COMMIT,
    };
    return {
        measurable: true,
        fileLinkBase: null,
        mermaid: 'flowchart LR\n    n_server --> n_parser\n',
        receipt: {
            schemaVersion: 1,
            graph: {
                groups: [],
                nodes: [
                    { id: 'n_server', type: 'box', label: 'server.ts', path: 'kokpit/server.ts', groupId: 'runtime' },
                    { id: 'n_parser', type: 'box', label: 'parser.ts', path: 'kokpit/parser/parser.ts', groupId: 'analysis' },
                ],
                edges: [{ from: 'n_server', to: 'n_parser', label: 'imports' }],
            },
            nodeEvidence: {
                n_server: { ...receiptEvidence, path: 'kokpit/server.ts', phaseHeading: PHASE, itemId: `${PHASE}::madde-1`, itemStatus: 'done', evidenceKind: 'plan-path-match', testPaths: [TEST_PATH] },
                n_parser: { ...receiptEvidence, path: 'kokpit/parser/parser.ts', evidenceKind: 'measured-import', testPaths: [] },
            },
            measurements: { scannedFileCount: 2, totalEdgeCount: 1, renderedNodeCount: 2, renderedEdgeCount: 1, unresolvedCount: 0, durationMs: 4 },
            unmatchedPlanItems: [],
            itemMappings: { [`${PHASE}::madde-1`]: { nodeIds: ['n_server'], paths: ['kokpit/server.ts'], testPaths: [TEST_PATH] } },
        },
    };
}

function measuredDelta(projectId = 'mock-proj') {
    return {
        delta: {
            schemaVersion: 1,
            projectId,
            itemId: `${PHASE}::madde-1`,
            phaseHeading: PHASE,
            mode: 'measured',
            baseRevision: { kind: 'commit', revision: COMMIT, commit: COMMIT, branch: 'main' },
            declaredPaths: ['kokpit/server.ts'],
            affectedNodeIds: ['n_server'],
            affectedPaths: ['kokpit/server.ts'],
            affectedTests: [TEST_PATH],
            proposedNodes: [],
            addedEdges: [],
            removedEdges: [],
            evidenceKind: 'receipt-mapping',
            reasons: [],
            durationMs: 3,
        },
    };
}

function unmeasurableDelta(reasonCode: string, projectId = 'mock-proj') {
    return {
        delta: {
            schemaVersion: 1,
            projectId,
            itemId: `${PHASE}::madde-1`,
            phaseHeading: PHASE,
            mode: 'unmeasurable',
            baseRevision: { kind: 'working-tree', revision: COMMIT, commit: COMMIT, branch: 'main' },
            declaredPaths: [],
            affectedNodeIds: [],
            affectedPaths: [],
            affectedTests: [],
            proposedNodes: [],
            addedEdges: [],
            removedEdges: [],
            evidenceKind: 'none',
            reasons: [{ code: reasonCode, message: 'mock unmeasurable reason' }],
            durationMs: 1,
        },
    };
}

const MOCK_REPORT = {
    version: 1,
    projectId: 'mock-proj',
    sourceRevision: COMMIT,
    generatedAt: '2026-08-31T09:00:00.000Z',
    measurement: 'measured',
    reasons: [],
    violations: [
        {
            id: HEX_ID,
            rule: 'hex-in-component',
            severity: 'error',
            state: 'open',
            targetPath: 'frontend/src/app.css',
            targetLine: 12,
            message: 'Hex color literal found outside the token registry; use --st-* design tokens only.',
            ruleReference: 'DESIGN D2: bileşende hex yasak; yalnız --st-* belirteçleri',
            contextFriction: 'low',
            changeCount: 0,
        },
        {
            id: 'hex-in-component:frontend-src-theme-css:48',
            rule: 'hex-in-component',
            severity: 'warning',
            state: 'open',
            targetPath: 'frontend/src/theme.css',
            targetLine: 48,
            message: 'Hex color literal found outside the token registry.',
            ruleReference: 'DESIGN D2: bileşende hex yasak',
            contextFriction: 'low',
            changeCount: 0,
        },
        {
            id: 'hex-in-component:frontend-src-card-tsx:7',
            rule: 'hex-in-component',
            severity: 'note',
            state: 'open',
            targetPath: 'frontend/src/Card.tsx',
            targetLine: 7,
            message: 'Hex color literal found outside the token registry.',
            ruleReference: 'DESIGN D2: bileşende hex yasak',
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
            message: 'Plan item was completed long ago; the box has not been re-verified.',
            ruleReference: 'UI-SPEC §3.3: bayat veri ayrı sinyal',
            contextFriction: 'low',
            changeCount: 0,
        },
    ],
    sync: [
        {
            sliceId: 'Dilim 5 · Uyum Telemetrisi',
            phaseFile: 'current',
            roadmapBox: 'current',
            handoff: 'current',
            nearMiss: { reasonCode: 'date-gap', message: 'Latest phase-file signal predates the roadmap completion date by more than 7 days.' },
        },
    ],
    conflicts: [
        {
            id: 'conflict:test-topic',
            topic: 'korpus, tez',
            status: 'candidate',
            authorityA: 'ROADMAP.md · L37 — "…TR korpusu değildir…"',
            authorityB: '.agents/karar-defteri.md · L46 — D4-I · Korpus erişimi (2026-08-22)',
            observedAtA: '2026-07-28',
            observedAtB: '2026-08-22',
            suggestion: 'Add a superseded-note to the older authority line.',
        },
    ],
    health: { phaseDone: 50, partial: 2, open: 6, syncStale: 0, vioErr: 1, vioWarn: 1, conflictOpen: 0 },
    coverage: { eligibleFiles: 3, scannedFiles: 3, skippedLargeFiles: 0, unreadableFiles: 0, skippedSymlinks: 0, outsideRootPaths: 0, truncated: false },
};

function explainEnvelope(kind: string, id: string, overrides: Record<string, unknown> = {}) {
    return {
        schemaVersion: 1,
        projectId: 'mock-proj',
        sourceRevision: COMMIT,
        subjectKind: kind,
        subjectId: id,
        origin: 'deterministic',
        summary: { tr: 'Kural ihlali ölçüldü.', en: 'A rule violation was measured.' },
        whatItMeans: { tr: 'Bileşen dosyasında token dışı hex renk kodu bulundu.', en: 'A non-token hex color literal was found in a component file.' },
        whyItMatters: { tr: 'Sabit renk, tema ve sağlık bandı tutarlılığını bozar.', en: 'A literal color breaks theme and health-band consistency.' },
        recommendedActions: [{ id: 'map-plan-path', label: { tr: 'Rengi --st-* tasarım tokenına taşı', en: 'Move the color to an --st-* design token' } }],
        verificationSteps: [{ tr: 'Yeniden uyum taraması bu dosyada hex döndürmez.', en: 'A fresh compliance scan reports no hex for this file.' }],
        evidenceRefs: [{ label: { tr: 'Kural', en: 'Rule' }, value: 'hex-in-component' }],
        limitations: [{ tr: 'Bu açıklama ölçümlü kaydı değiştirmez.', en: 'This explanation does not change the measured record.' }],
        generatedAt: '2026-08-31T10:00:00.000Z',
        ...overrides,
    };
}

interface MockOptions {
    readonly deltaSupplier?: () => unknown;
    readonly explainSupplier?: (url: URL) => unknown;
}

async function installMocks(page: Page, options: MockOptions = {}): Promise<void> {
    const record = projectRecord();
    const registry = { projects: [record], activeProjectId: record.id };
    await page.route('**/api/projects', route => route.fulfill({ json: registry }));
    await page.route('**/api/projects/active', route => route.fulfill({ json: {} }));
    await page.route('**/api/projects/mock-proj/diagram', route => route.fulfill({ json: diagramPayload() }));
    await page.route('**/api/projects/mock-proj/reindex', route => route.fulfill({ json: {} }));
    await page.route('**/api/projects/*/delta*', route => route.fulfill({ json: options.deltaSupplier ? options.deltaSupplier() : measuredDelta() }));
    await page.route('**/api/projects/*/compliance', route => route.fulfill({ json: { report: MOCK_REPORT } }));
    await page.route('**/api/projects/*/explain*', (route: Route) => {
        const url = new URL(route.request().url());
        const payload = options.explainSupplier
            ? options.explainSupplier(url)
            : { envelope: explainEnvelope(url.searchParams.get('kind') || 'violation', url.searchParams.get('id') || '') };
        if (payload && typeof payload === 'object' && (payload as { status?: string }).status === 'error') {
            return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'explain unavailable' }) });
        }
        return route.fulfill({ json: payload });
    });
}

async function openWorkspace(page: Page): Promise<void> {
    await page.goto('/arayuz-onizleme.html');
    await expect(page.locator('#activeProjectName')).toHaveText('Mock Proje');
    await page.locator('.primary-nav-button[data-section="workspace"]').click();
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 });
}

async function openComplianceView(page: Page): Promise<void> {
    await page.locator('#tab-compliance').click();
    await expect(page.locator('#view-compliance')).toBeVisible();
}

async function openPhaseItem(page: Page, titleText: string) {
    await page.locator('#phaseList .phase-filter[data-phase="Dilim-5.2"]').click();
    const details = page.locator('.phase-item').filter({ hasText: titleText });
    // firstUnfinished önceden açık gelebilir: önce kapat, seçimi gerçek tıklamayla yap.
    await details.evaluate(element => { element.open = false; });
    await details.locator('summary').click();
    return details;
}

test.describe('Dilim 5.2 açıklanabilir arayüz (hermetik maskeler)', () => {

    test('S1 · kural bazlı gruplama: 3 hex → 1 grup satırı; açılınca 3 tekil satır; sayaçlar değişmez', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page);
        await openWorkspace(page);
        await openComplianceView(page);

        const groupRow = page.locator('[data-queue-group="hex-in-component"]');
        await expect(groupRow).toContainText('Bileşende hex');
        await expect(groupRow).toContainText('3 kayıt');
        await expect(groupRow).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('#issueList .issue-row')).toHaveCount(4);
        await expect(page.locator('#issueList .issue-row.is-member')).toHaveCount(0);
        await expect(page.locator('#queueCountAll')).toHaveText('6');
        await expect(page.locator('#queueCountViolation')).toHaveText('4');

        await groupRow.click();
        await expect(groupRow).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#issueList .issue-row.is-member')).toHaveCount(3);
        await expect(page.locator('#issueList .issue-row')).toHaveCount(7);
        await expect(page.locator('#issueList .issue-row.is-member').filter({ hasText: 'app.css' })).toHaveCount(1);
        await expect(page.locator('#issueList .issue-row.is-member').filter({ hasText: 'theme.css' })).toHaveCount(1);
        await expect(page.locator('#issueList .issue-row.is-member').filter({ hasText: 'Card.tsx' })).toHaveCount(1);

        // Gruplama ölçülen sayıları değiştirmez.
        await expect(page.locator('#queueCountAll')).toHaveText('6');
        await expect(page.locator('#queueCountViolation')).toHaveText('4');
        await expect(page.locator('#signalViolationOpen')).toHaveText('2');
    });

    test('S2 · tekil satır → denetçi: 4 soru görünür; Teknik kanıt kapalı başlar, açılınca kanıt görünür', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        let explainUrl = '';
        await installMocks(page, {
            explainSupplier: url => {
                explainUrl = url.toString();
                return { envelope: explainEnvelope(url.searchParams.get('kind') || 'violation', url.searchParams.get('id') || '') };
            },
        });
        await openWorkspace(page);
        await openComplianceView(page);

        await page.locator('[data-queue-group="hex-in-component"]').click();
        await page.locator('#issueList .issue-row.is-member').filter({ hasText: 'app.css' }).click();

        const body = page.locator('#inspectorBody');
        await expect(body.locator('.explain-card[data-explain-status="ready"]')).toBeVisible();
        await expect(body).toContainText('Ne oldu?');
        await expect(body).toContainText('Bu neden önemli?');
        await expect(body).toContainText('Önerilen ilk eylem');
        await expect(body).toContainText('Doğrulama');
        await expect(body).toContainText('token dışı hex renk kodu bulundu');
        expect(explainUrl).toContain('kind=violation');
        expect(explainUrl).toContain(encodeURIComponent(HEX_ID));

        const details = body.locator('.technical-evidence');
        await expect(details).toHaveCount(1);
        expect(await details.getAttribute('open')).toBeNull();
        const firstSection = details.locator('.detail-section').first();
        await expect(firstSection).toBeHidden();
        await details.locator('summary').click();
        await expect(firstSection).toBeVisible();
        await expect(details).toContainText('frontend/src/app.css:12');
        await expect(details).toContainText('hex-in-component');
        await expect(details).toContainText('DESIGN D2');
    });

    test('S3 · explain 500: dürüst not; teknik kanıt bölümü hâlâ açılabilir', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { explainSupplier: () => ({ status: 'error' }) });
        await openWorkspace(page);
        await openComplianceView(page);

        await page.locator('[data-queue-group="hex-in-component"]').click();
        await page.locator('#issueList .issue-row.is-member').filter({ hasText: 'app.css' }).click();

        const body = page.locator('#inspectorBody');
        await expect(body.locator('.explain-card[data-explain-status="error"]')).toBeVisible();
        await expect(body).toContainText('Açıklama alınamadı');

        const details = body.locator('.technical-evidence');
        await details.locator('summary').click();
        await expect(details.locator('.detail-section').first()).toBeVisible();
        await expect(details).toContainText('frontend/src/app.css:12');
    });

    test('S4 · AI YORUMU katmanı: provenance ve sınırlar görünür; ölçülen sayaçlar ve ciddiyet değişmez', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, {
            explainSupplier: url => ({
                envelope: explainEnvelope(url.searchParams.get('kind') || 'violation', url.searchParams.get('id') || '', {
                    origin: 'ai',
                    provider: 'mock-provider',
                    model: 'mock-model-large',
                    confidence: 0.82,
                }),
            }),
        });
        await openWorkspace(page);
        await openComplianceView(page);

        await page.locator('[data-queue-group="hex-in-component"]').click();
        await page.locator('#issueList .issue-row.is-member').filter({ hasText: 'app.css' }).click();

        const body = page.locator('#inspectorBody');
        const ai = body.locator('[data-ai-comment]');
        await expect(ai).toBeVisible();
        await expect(ai).toContainText('AI YORUMU');
        await expect(ai).toContainText('mock-provider · mock-model-large');
        await expect(ai).toContainText(COMMIT.slice(0, 8));
        await expect(ai).toContainText('Bu açıklama ölçümlü kaydı değiştirmez');
        await expect(body.locator('.explain-card')).toHaveAttribute('data-explain-origin', 'ai');

        // Ölçülen gerçeklik mock raporla aynı kalır.
        await expect(page.locator('#queueCountAll')).toHaveText('6');
        await expect(page.locator('#queueCountViolation')).toHaveText('4');
        await expect(page.locator('#signalViolationOpen')).toHaveText('2');
        await expect(body.locator('.detail-status .severity')).toContainText('Hata');
    });

    test('S5 · near-miss ilk katman çevirisi: kullanıcı dili görünür, raw kod yalnız teknik bölümde', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page);
        await openWorkspace(page);
        await openComplianceView(page);

        const syncRow = page.locator('#issueList .issue-row').filter({ hasText: 'Plan kaydı ile teslim kaydı uyuşmuyor' });
        await expect(syncRow).toHaveCount(1);
        const listText = await page.locator('#issueList').innerText();
        expect(listText).not.toContain('date-gap');
        expect(listText).not.toContain('near-miss');

        await syncRow.click();
        const details = page.locator('#inspectorBody .technical-evidence');
        await details.locator('summary').click();
        await expect(details).toContainText('date-gap');
    });

    test('S6 · delta güvenli eylemler: no-local-checkout → bağlama metni, yeniden indeksle YOK; stale → yeniden indeksle VAR', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { deltaSupplier: () => unmeasurableDelta('no-local-checkout') });
        await openWorkspace(page);
        await openPhaseItem(page, ITEM1_TEXT);
        await page.locator('#tab-delta').click();

        const panel = page.locator('#deltaPanelBody');
        await expect(panel.locator('[data-delta-status="unmeasurable"]')).toBeVisible();
        await expect(panel).toContainText('yerel çalışma kopyası yok; kanıt için repoyu yerel olarak bağla');
        await expect(panel).toContainText('Eksik veri: yerel çalışma kopyası');
        expect(await panel.locator('[data-map-reindex]').count()).toBe(0);
        const technical = panel.locator('.delta-technical');
        await technical.locator('summary').click();
        await expect(technical).toContainText('no-local-checkout');
    });

    test('S6b · bayat makbuz: yeniden indeksle butonu korunur', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { deltaSupplier: () => unmeasurableDelta('stale-receipt') });
        await openWorkspace(page);
        await openPhaseItem(page, ITEM1_TEXT);
        await page.locator('#tab-delta').click();

        const panel = page.locator('#deltaPanelBody');
        await expect(panel.locator('[data-delta-status="stale"]')).toBeVisible();
        await expect(panel.locator('[data-map-reindex="mock-proj"]')).toBeVisible();
    });

    test('S7 · görünüm değişimi ilgisiz denetçiyi sıfırlar: uyum kaydı → Zaman sekmesi → denetçi boş', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page);
        await openWorkspace(page);
        await openComplianceView(page);

        await page.locator('#issueList .issue-row').filter({ hasText: 'Bayat kutu' }).click();
        await expect(page.locator('#inspectorBody')).toContainText('Bayat kutu');

        await page.locator('#tab-timeline').click();
        await expect(page.locator('#view-timeline')).toBeVisible();
        const body = page.locator('#inspectorBody');
        await expect(body).toContainText('Henüz seçim yok');
        await expect(body).not.toContainText('Teknik kanıt');
        await expect(body).not.toContainText('Kapatmayı kaydet');
    });

    test('S8 · TR/EN: grup, sync başlığı, kabul rozeti ve teknik kanıt iki dilde çevrilir', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page);
        await openWorkspace(page);
        await openComplianceView(page);

        await expect(page.locator('[data-queue-group="hex-in-component"]')).toContainText('kayıt');
        await page.locator('#tab-timeline').click();
        await expect(page.locator('.acceptance-badge')).toHaveText('Kabul açık (plan)');

        await page.locator('#langEn').click();
        await expect(page.locator('.acceptance-badge')).toHaveText('Acceptance open (plan)');
        await page.locator('#tab-compliance').click();
        const groupRow = page.locator('[data-queue-group="hex-in-component"]');
        await expect(groupRow).toContainText('Hex in component');
        await expect(groupRow).toContainText('records');
        await expect(page.locator('#issueList .issue-row').filter({ hasText: 'Plan record and delivery record disagree' })).toHaveCount(1);

        await groupRow.click();
        await page.locator('#issueList .issue-row.is-member').filter({ hasText: 'app.css' }).click();
        const body = page.locator('#inspectorBody');
        await expect(body.locator('.explain-card[data-explain-status="ready"]')).toContainText('What happened?');
        await expect(body.locator('.explain-card[data-explain-status="ready"]')).toContainText('Why does it matter?');
        await expect(body.locator('.technical-evidence > summary')).toContainText('Technical evidence');

        await page.locator('#langTr').click();
        await expect(body.locator('.explain-card[data-explain-status="ready"]')).toContainText('Ne oldu?');
        await expect(body.locator('.technical-evidence > summary')).toContainText('Teknik kanıt');
    });

    test('S9 · 1440/1024/768 genişliklerde açıklanabilir uyum yüzeyi yatay taşmaz', async ({ page }) => {
        await installMocks(page);
        await openWorkspace(page);
        await openComplianceView(page);
        await page.locator('[data-queue-group="hex-in-component"]').click();
        await page.locator('#issueList .issue-row.is-member').filter({ hasText: 'app.css' }).click();
        for (const width of [1440, 1024, 768]) {
            await page.setViewportSize({ width, height: 820 });
            await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        }
    });

    test('S10 · klavye: grup satırı Enter ile açılır; disclosure Enter ile açılır; Escape denetçiyi kapatır', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 820 });
        await installMocks(page);
        await openWorkspace(page);
        await openComplianceView(page);

        const groupRow = page.locator('[data-queue-group="hex-in-component"]');
        await groupRow.focus();
        await page.keyboard.press('Enter');
        await expect(groupRow).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#issueList .issue-row.is-member')).toHaveCount(3);
        await expect(groupRow).toBeFocused();

        await page.keyboard.press('Tab');
        const member = page.locator('#issueList .issue-row.is-member').first();
        await expect(member).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('body')).toHaveClass(/inspector-open/);

        const summary = page.locator('#inspectorBody .technical-evidence > summary');
        await summary.focus();
        await page.keyboard.press('Enter');
        const opened = await summary.evaluate(element => element.parentElement?.hasAttribute('open') ?? false);
        expect(opened).toBe(true);

        await page.keyboard.press('Escape');
        await expect(page.locator('body')).not.toHaveClass(/inspector-open/);
    });
});
