import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/*
 * Dilim 5.2 · Delta ve zaman davranışı kabulü (PLAN 5.2.5, UI-SPEC §10.9.4).
 * S1–S2 HERMETİKTİR: yalnız page.route maskeleriyle çalışır, uydurma veri
 * yalnız taşıyıcıdır ve gerçek delta payload'ı sabitlemez. S3–S5 GERÇEK
 * sunucudadır (webServer izole port + temp KOKPIT_DATA_DIR; Dilim 5 S9
 * deseninde maskesiz API turu). Klavye/Escape/taşma nöbetçileri bu dilimin
 * kapsamı DEĞİLDİR (Alt C spec'i; Alt D spec'indedir).
 */

const artifacts = resolve('output', 'playwright', 'dilim-5-2');
const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const TEST_PATH = 'kokpit/parser/__tests__/roadmap.test.ts';

// Plan başlıkları birebir PLAN.md'deki gerçek başlıklardır: "Dilim 5" ile
// "Dilim 5.2" iki AYRI fazdır; alt dilim üst dilime asla eritilmez.
const PHASE_5 = 'Dilim 5 · Uyum Telemetrisi';
const PHASE_52 = 'Dilim 5.2 · Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit';

function planMarkdown(): string {
    return [
        '# Mock Plan',
        '',
        `## ${PHASE_5}`,
        '',
        '- [x] **`kokpit/server.ts` telemetri kabulü**: gerçek makbuz eşleşmesi',
        '',
        `## ${PHASE_52}`,
        '',
        '- [ ] **5.2.0 — Sözleşme dondurma:** ExplanationEnvelope v1',
        '- [ ] **5.2.5 — Delta ve zaman davranışı:** ölçülemeyen deltada dürüst neden',
        '',
    ].join('\n');
}

function projectRecord() {
    return {
        id: 'mock-52',
        name: 'Mock Proje',
        source: { type: 'local', root: 'C:/mock/mock-52' },
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
            indexedAt: new Date().toISOString(),
            summary: { phaseCount: 2, itemCount: 3 },
            groups: [
                {
                    heading: PHASE_5,
                    gateStatus: null,
                    line: 3,
                    items: [
                        { id: 'madde-1', title: '`kokpit/server.ts` telemetri kabulü', status: 'done', phaseHeading: PHASE_5, line: 5 },
                    ],
                },
                {
                    heading: PHASE_52,
                    gateStatus: null,
                    line: 8,
                    items: [
                        { id: 'madde-1', title: '5.2.0 — Sözleşme dondurma', status: 'open', phaseHeading: PHASE_52, line: 10 },
                        { id: 'madde-2', title: '5.2.5 — Delta ve zaman davranışı', status: 'open', phaseHeading: PHASE_52, line: 11 },
                    ],
                },
            ],
            nodes: [
                { id: 'n_server', title: 'server.ts', path: 'kokpit/server.ts', status: 'done', evidence: 'plan-path-match' },
            ],
        },
    };
}

function diagramPayload() {
    const receiptEvidence = {
        projectId: 'mock-52',
        branch: 'main',
        commit: COMMIT,
        revisionKind: 'commit',
        revision: COMMIT,
    };
    return {
        measurable: true,
        fileLinkBase: null,
        mermaid: 'flowchart LR\n    n_server\n',
        receipt: {
            schemaVersion: 1,
            graph: {
                groups: [],
                nodes: [
                    { id: 'n_server', type: 'box', label: 'server.ts', path: 'kokpit/server.ts', groupId: 'runtime' },
                ],
                edges: [],
            },
            nodeEvidence: {
                n_server: { ...receiptEvidence, path: 'kokpit/server.ts', phaseHeading: PHASE_5, itemId: `${PHASE_5}::madde-1`, itemStatus: 'done', evidenceKind: 'plan-path-match', testPaths: [TEST_PATH] },
            },
            measurements: { scannedFileCount: 1, totalEdgeCount: 0, renderedNodeCount: 1, renderedEdgeCount: 0, unresolvedCount: 0, durationMs: 4 },
            unmatchedPlanItems: [],
            itemMappings: { [`${PHASE_5}::madde-1`]: { nodeIds: ['n_server'], paths: ['kokpit/server.ts'], testPaths: [TEST_PATH] } },
        },
    };
}

/** 5.2 maddelerinin kod eşlemesi yoktur: dürüst sınır — unmeasurable + no-mapping. */
function noMappingDelta() {
    return {
        delta: {
            schemaVersion: 1,
            projectId: 'mock-52',
            itemId: `${PHASE_52}::madde-1`,
            phaseHeading: PHASE_52,
            mode: 'unmeasurable',
            baseRevision: { kind: 'commit', revision: COMMIT, commit: COMMIT, branch: 'main' },
            declaredPaths: [],
            affectedNodeIds: [],
            affectedPaths: [],
            affectedTests: [],
            proposedNodes: [],
            addedEdges: [],
            removedEdges: [],
            evidenceKind: 'none',
            reasons: [{
                code: 'no-mapping',
                message: 'Bu madde için doğrulanmış dosya ya da test eşlemesi yok; güvenli eylem: plan maddesine ölçülebilir bir yol bağlayın.',
            }],
            durationMs: 1,
        },
    };
}

function measuredDelta() {
    return {
        delta: {
            schemaVersion: 1,
            projectId: 'mock-52',
            itemId: `${PHASE_5}::madde-1`,
            phaseHeading: PHASE_5,
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

async function installMocks(page: Page): Promise<void> {
    const record = projectRecord();
    const registry = { projects: [record], activeProjectId: record.id };

    await page.route('**/api/projects', route => route.fulfill({ json: registry }));
    await page.route('**/api/projects/active', route => route.fulfill({ json: {} }));
    await page.route(`**/api/projects/${record.id}/diagram`, route => route.fulfill({ json: diagramPayload() }));
    await page.route(`**/api/projects/${record.id}/reindex`, route => route.fulfill({ json: {} }));
    await page.route('**/api/projects/*/delta*', route => {
        const phase = new URL(route.request().url()).searchParams.get('phase') ?? '';
        const payload = phase === PHASE_52 ? noMappingDelta() : measuredDelta();
        return route.fulfill({ json: payload });
    });
}

async function waitForMap(page: Page): Promise<void> {
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 });
}

async function openWorkspace(page: Page, projectName: string): Promise<void> {
    await page.goto('/arayuz-onizleme.html');
    await expect(page.locator('#activeProjectName')).toHaveText(projectName);
    await page.locator('.primary-nav-button[data-section="workspace"]').click();
    await waitForMap(page);
}

/** Faz çipini seçip 5.2'nin açık maddesini gerçek tıklamayla açar (delta isteği tetiklenir). */
async function openSlice52Item(page: Page, titleText: string) {
    await page.locator('#phaseList .phase-filter[data-phase="Dilim-5.2"]').click();
    const details = page.locator('.phase-item').filter({ hasText: titleText });
    // firstUnfinished önceden açık gelebilir: önce kapat, seçimi gerçek tıklamayla yap.
    await details.evaluate(element => { element.open = false; });
    await details.locator('summary').click();
    return details;
}

interface KokpitProjectRecord {
    readonly id: string;
    readonly index: {
        readonly groups: ReadonlyArray<{ readonly heading: string; readonly items: ReadonlyArray<{ readonly id: string; readonly status: string }> }>;
    };
}

/** S9 deseni: maskesiz gerçek sunucudan KokpitPro kalıcı kaydını getirir. */
async function kokpitProject(request: APIRequestContext): Promise<KokpitProjectRecord> {
    const registry = await (await request.get('/api/projects')).json();
    const kokpit = registry.projects.find((project: { name: string }) => project.name === 'KokpitPro');
    expect(kokpit).toBeTruthy();
    return kokpit;
}

async function kokpitPlanText(request: APIRequestContext, project: KokpitProjectRecord): Promise<string> {
    const response = await request.get(`/api/projects/${encodeURIComponent(project.id)}/plan`);
    expect(response.ok()).toBe(true);
    return response.text();
}

test.beforeAll(() => { mkdirSync(artifacts, { recursive: true }); });

test.describe('Dilim 5.2 zaman ve delta (hermetik maskeler)', () => {

    test('S1 · Zaman görünümünde Dilim 5 ve Dilim 5.2 ayrı gruplar; 5.2 açıkken de listede kalır', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page);
        await openWorkspace(page, 'Mock Proje');

        // Entegre üründe EN sözlüğü Dilim-5.2'yi ayrı adlandırır; alt dilim üst
        // dilimin adını asla devralmaz (Dilim-5 girdisinden ayrı girdi).
        const entries = await page.evaluate(() => {
            try {
                return {
                    has52: Object.prototype.hasOwnProperty.call(PHASE_NAMES_EN, 'Dilim-5.2'),
                    has5: Object.prototype.hasOwnProperty.call(PHASE_NAMES_EN, 'Dilim-5'),
                    distinct: (PHASE_NAMES_EN as Record<string, string>)['Dilim-5.2'] !== (PHASE_NAMES_EN as Record<string, string>)['Dilim-5'],
                };
            } catch {
                return { has52: false, has5: false, distinct: true }; // sözlük bu derlemede görünmüyorsa grup-başlığı nöbetçisi yeterlidir
            }
        });
        expect(entries.has52).toBe(true);
        expect(entries.has5).toBe(true);
        expect(entries.distinct).toBe(true);

        // Zaman görünümü: iki AYRI grup başlığı; alt dilim üst dilime eritilmez.
        await page.locator('#tab-timeline').click();
        const timeline = page.locator('#timelineContent');
        await expect(timeline.locator('.timeline-group')).toHaveCount(2);
        await expect(timeline.locator('.timeline-name').filter({ hasText: 'Dilim-5 ·' })).toHaveCount(1);
        await expect(timeline.locator('.timeline-name').filter({ hasText: 'Dilim-5.2 ·' })).toHaveCount(1);
        // "Kabul açık" ≠ "motor yapılmadı": açık maddeler de zaman çizgisinde kayıpsız.
        const group52 = timeline.locator('.timeline-group').filter({ hasText: 'Dilim-5.2 ·' });
        await expect(group52.locator('.timeline-item')).toHaveCount(2);
        await expect(group52.locator('.timeline-item').filter({ hasText: '5.2.0 — Sözleşme dondurma' })).toBeVisible();

        // Faz rayında 5.2 açık kabul durumundayken de durur; seçilince madde satırları açılır.
        const chip = page.locator('#phaseList .phase-filter[data-phase="Dilim-5.2"]');
        await expect(chip).toBeVisible();
        await chip.click();
        const details = page.locator('.phase-item').filter({ hasText: '5.2.0 — Sözleşme dondurma' });
        await expect(details).toHaveCount(1);
        await details.evaluate(element => { element.open = false; });
        await details.locator('summary').click();
        await expect(details.locator('.phase-item-title')).toContainText('5.2.0 — Sözleşme dondurma');
        await page.screenshot({ path: resolve(artifacts, 's1-timeline-1440.png'), fullPage: true });
    });

    test('S2 · 5.2 açık maddesinde delta paneli boş beyaz alan DEĞİL: no-mapping nedeni görünür', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page);
        await openWorkspace(page, 'Mock Proje');

        const details = await openSlice52Item(page, '5.2.0 — Sözleşme dondurma');
        // Denetçi kartı da boş kalmaz: dürüst ölçülemedi notu görünür.
        await expect(details.locator('[data-inspector-delta-card]')).toContainText('Bu madde için delta ölçülemedi', { timeout: 15_000 });

        await page.locator('#tab-delta').click();
        const panelBody = page.locator('#deltaPanelBody');
        await expect(page.locator('#view-delta[data-live="true"]')).toBeVisible();
        await expect(panelBody.locator('[data-delta-status="unmeasurable"]')).toBeVisible();
        // Neden + dürüst durum metni görünür (kullanıcı eylemi katmanı Alt D'de tamamlanır;
        // bu test yalnız neden metninin varlığını doğrular).
        await expect(panelBody).toContainText('Bu madde için delta ölçülemedi');
        await expect(panelBody).toContainText('Madde metni ölçümlü graf düğümleriyle eşleşmedi.');
        // Ölçülemez sonuçta uydurma etkileme yüzeyi çizilmez.
        await expect(panelBody).not.toContainText('Etkilenen kod');
        await expect(panelBody).not.toContainText('Etkilenen testler');
        await page.screenshot({ path: resolve(artifacts, 's2-no-mapping-1440.png'), fullPage: true });
    });
});

test.describe('Dilim 5.2 gerçek sunucu sözleşmesi (maskesiz — S9 deseni)', () => {

    test('S3 · PLAN yanıtında Dilim 5 ve Dilim 5.2 ayrı başlıklar; kalıcı indeks iki ayrı grup taşır', async ({ request }) => {
        const kokpit = await kokpitProject(request);
        const planText = await kokpitPlanText(request, kokpit);
        const lines = planText.split(/\r?\n/);
        const line5 = lines.findIndex(line => /^## Dilim 5 ·/.test(line));
        const line52 = lines.findIndex(line => /^## Dilim 5\.2 ·/.test(line));
        expect(line5).toBeGreaterThan(-1);
        expect(line52).toBeGreaterThan(-1);
        expect(line52).not.toBe(line5);
        expect(lines[line52]).toBe(`## ${PHASE_52}`);

        // Parser kimlik nöbetçisi canlı veride: iki AYRI grup; 5.2'nin maddeleri
        // açık ([ ]) olsa bile grup kayıpsız ve kendi başlığıyladır.
        const headings = kokpit.index.groups.map(group => group.heading);
        expect(headings.some(heading => heading.startsWith('Dilim 5 ·'))).toBe(true);
        expect(headings.some(heading => heading.startsWith('Dilim 5.2 ·'))).toBe(true);
        const group52 = kokpit.index.groups.find(group => group.heading.startsWith('Dilim 5.2 ·'));
        expect(group52?.items.length).toBeGreaterThan(0);
        expect(group52?.items.some(item => item.status === 'open')).toBe(true);
        for (const item of group52?.items ?? []) {
            expect(item.id).toBeTruthy();
        }
    });

    test('S4 · ölçülebilir maddede delta gerçek yolları bildirir (uydurma yok)', async ({ request }) => {
        const kokpit = await kokpitProject(request);
        const planText = await kokpitPlanText(request, kokpit);
        // Faz başlığı hardcode edilmez; plan yanıtındaki gerçek başlıktan türetilir.
        const phaseMatch = /^## (Dilim 1 · [^\r\n]+)$/m.exec(planText);
        expect(phaseMatch).toBeTruthy();
        const phase = phaseMatch?.[1]?.trim() ?? '';
        const response = await request.get(
            `/api/projects/${encodeURIComponent(kokpit.id)}/delta?phase=${encodeURIComponent(phase)}&item=${encodeURIComponent('madde-1')}`,
        );
        expect(response.ok()).toBe(true);
        const { delta } = await response.json();
        expect(['measured', 'declared-only']).toContain(delta.mode);
        expect(Array.isArray(delta.affectedPaths)).toBe(true);
        expect(delta.affectedPaths.length).toBeGreaterThanOrEqual(1);
        // Dilim 1 · madde-1'in gerçek kod yüzeyi parser'ın kendisidir.
        expect(delta.affectedPaths).toContain('kokpit/parser/roadmap.ts');
    });

    test('S5 · 5.2 maddesi dürüst ölçülemez sınırdadır: no-mapping/paths-not-measured, uydurma liste yok', async ({ request }) => {
        const kokpit = await kokpitProject(request);
        const planText = await kokpitPlanText(request, kokpit);
        const phaseMatch = /^## (Dilim 5\.2 · [^\r\n]+)$/m.exec(planText);
        expect(phaseMatch).toBeTruthy();
        const phase = phaseMatch?.[1]?.trim() ?? '';
        const response = await request.get(
            `/api/projects/${encodeURIComponent(kokpit.id)}/delta?phase=${encodeURIComponent(phase)}&item=${encodeURIComponent('madde-1')}`,
        );
        expect(response.ok()).toBe(true);
        const { delta } = await response.json();
        expect(delta.mode).toBe('unmeasurable');
        const codes = (delta.reasons ?? []).map((reason: { code: string }) => reason.code);
        expect(codes.length).toBeGreaterThan(0);
        expect(codes.some(code => code === 'no-mapping' || code === 'paths-not-measured')).toBe(true);
        // 5.2 maddelerinin kod eşlemesi yoktur: ölçülmüş yüzey UYDURULMAZ.
        expect(delta.affectedPaths).toEqual([]);
        expect(delta.affectedTests).toEqual([]);
    });
});
