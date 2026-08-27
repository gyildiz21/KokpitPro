import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Dilim 3 · Delta kabul koşumu — tamamen page.route maskeleriyle hermetik.
// Gerçek sunucu turu ana ajanca ayrıca kanıtlanır; bu dosya uydurma veriyi
// yalnız taşıyıcı olarak kullanır ve hiçbir yerde örnek delta payload'ı sabitlemez.

const artifacts = resolve('output', 'playwright', 'dilim-3');
const PHASE = 'Dilim 0 · Motor';
const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const TEST_PATH = 'kokpit/parser/__tests__/roadmap.test.ts';

function planMarkdown(): string {
    return [
        '# Mock Plan',
        '',
        `## ${PHASE}`,
        '',
        '- [x] **`kokpit/server.ts` kabulü**: gerçek makbuz eşleşmesi',
        '- [ ] **`kokpit/planlar/yeni-modul.ts` eklenecek**: yol henüz ölçülmedi',
        '',
    ].join('\n');
}

interface RecordOptions {
    readonly id?: string;
    readonly name?: string;
}

function projectRecord(options: RecordOptions = {}) {
    const id = options.id ?? 'mock-proj';
    const name = options.name ?? 'Mock Proje';
    return {
        id,
        name,
        source: { type: 'local', root: `C:/mock/${id}` },
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
                { id: 'n_roadmap', title: 'roadmap.ts', path: 'kokpit/parser/roadmap.ts', status: 'open', evidence: 'measured-import' },
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
        mermaid: 'flowchart LR\n    n_server --> n_parser\n    n_server --> n_roadmap\n',
        receipt: {
            schemaVersion: 1,
            graph: {
                groups: [],
                nodes: [
                    { id: 'n_server', type: 'box', label: 'server.ts', path: 'kokpit/server.ts', groupId: 'runtime' },
                    { id: 'n_parser', type: 'box', label: 'parser.ts', path: 'kokpit/parser/parser.ts', groupId: 'analysis' },
                    { id: 'n_roadmap', type: 'box', label: 'roadmap.ts', path: 'kokpit/parser/roadmap.ts', groupId: 'analysis' },
                ],
                edges: [
                    { from: 'n_server', to: 'n_parser', label: 'imports' },
                    { from: 'n_server', to: 'n_roadmap', label: 'imports' },
                ],
            },
            nodeEvidence: {
                n_server: { ...receiptEvidence, path: 'kokpit/server.ts', phaseHeading: PHASE, itemId: `${PHASE}::madde-1`, itemStatus: 'done', evidenceKind: 'plan-path-match', testPaths: [TEST_PATH] },
                n_parser: { ...receiptEvidence, path: 'kokpit/parser/parser.ts', evidenceKind: 'measured-import', testPaths: [] },
                n_roadmap: { ...receiptEvidence, path: 'kokpit/parser/roadmap.ts', evidenceKind: 'measured-import', testPaths: [] },
            },
            measurements: { scannedFileCount: 3, totalEdgeCount: 2, renderedNodeCount: 3, renderedEdgeCount: 2, unresolvedCount: 0, durationMs: 5 },
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
            durationMs: 4,
        },
    };
}

function declaredOnlyDelta(projectId = 'mock-proj') {
    return {
        delta: {
            schemaVersion: 1,
            projectId,
            itemId: `${PHASE}::madde-2`,
            phaseHeading: PHASE,
            mode: 'declared-only',
            baseRevision: { kind: 'commit', revision: COMMIT, commit: COMMIT, branch: 'main' },
            declaredPaths: ['kokpit/planlar/yeni-modul.ts'],
            affectedNodeIds: [],
            affectedPaths: [],
            affectedTests: [],
            proposedNodes: [{ id: 'prop-yeni-modul', label: 'yeni-modul.ts', path: 'kokpit/planlar/yeni-modul.ts' }],
            addedEdges: [],
            removedEdges: [],
            evidenceKind: 'declared-text-only',
            reasons: [{ code: 'edges-not-measurable-yet', message: 'edge measurement unavailable' }],
            durationMs: 2,
        },
    };
}

function staleDelta(projectId = 'mock-proj') {
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
            reasons: [{ code: 'stale-receipt', message: 'working tree differs from receipt' }],
            durationMs: 1,
        },
    };
}

/** Dilim 3 kapanışı: iki gerçek ölçüm arası kenar farkı (DeltaHistoryStore dikişi). */
function comparisonDelta(projectId = 'mock-proj') {
    const payload = measuredDelta(projectId);
    const delta = payload.delta as typeof payload.delta & {
        addedEdges: Array<{ from: string; to: string }>;
        removedEdges: Array<{ from: string; to: string }>;
    };
    delta.addedEdges = [{ from: 'n_parser', to: 'n_roadmap' }];
    delta.removedEdges = [{ from: 'n_server', to: 'n_roadmap' }];
    return payload;
}

interface MockOptions {
    readonly projects?: ReturnType<typeof projectRecord>[];
    readonly deltaSupplier?: () => unknown;
}

async function installMocks(page: Page, options: MockOptions = {}): Promise<void> {
    const records = options.projects ?? [projectRecord()];
    const registry = { projects: records, activeProjectId: records[0]!.id };

    await page.route('**/api/projects', route => route.fulfill({ json: registry }));
    await page.route('**/api/projects/active', route => route.fulfill({ json: {} }));
    for (const record of records) {
        if (record.id === 'proj-iki') {
            await page.route('**/api/projects/proj-iki/diagram', route => route.fulfill({ json: { measurable: false, reason: 'no-local-checkout' } }));
        } else {
            await page.route(`**/api/projects/${record.id}/diagram`, route => route.fulfill({ json: diagramPayload(record.id) }));
        }
        await page.route(`**/api/projects/${record.id}/reindex`, route => route.fulfill({ json: {} }));
    }
    await page.route('**/api/projects/*/delta*', route => {
        const payload = options.deltaSupplier ? options.deltaSupplier() : measuredDelta();
        return route.fulfill({ json: payload });
    });
}

async function waitForMap(page: Page): Promise<void> {
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 });
}

// Dar kırılımda denetçi modaldir + scrim tıklamaları yutar: sekme değiştirmeden önce kapat.
async function dismissModalInspector(page: Page): Promise<void> {
    const open = await page.locator('body').evaluate(body => body.classList.contains('inspector-open'));
    if (open) {
        await page.keyboard.press('Escape');
        await expect(page.locator('body')).not.toHaveClass(/inspector-open/);
    }
}

async function openWorkspace(page: Page, projectName: string): Promise<void> {
    await page.goto('/arayuz-onizleme.html');
    await expect(page.locator('#activeProjectName')).toHaveText(projectName);
    await page.locator('.primary-nav-button[data-section="workspace"]').click();
    await waitForMap(page);
}

const ITEM1_TEXT = '`kokpit/server.ts` kabulü';
const ITEM2_TEXT = '`kokpit/planlar/yeni-modul.ts` eklenecek';

async function openPhaseItem(page: Page, titleText: string) {
    await page.locator('#phaseList .phase-filter[data-phase="Dilim-0"]').click();
    const details = page.locator('.phase-item').filter({ hasText: titleText });
    // firstUnfinished önceden açık gelebilir: önce kapat, seçimi gerçek tıklamayla yap.
    await details.evaluate(element => { element.open = false; });
    await details.locator('summary').click();
    return details;
}

test.beforeAll(() => { mkdirSync(artifacts, { recursive: true }); });

test.describe('Dilim 3 delta akışı (hermetik maskeler)', () => {

    test('S1 · Ölçülmüş delta kartı, harita vurgusu ve delta paneli', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { deltaSupplier: () => measuredDelta() });
        await openWorkspace(page, 'Mock Proje');

        const details = await openPhaseItem(page, ITEM1_TEXT);
        const card = details.locator('[data-inspector-delta-card]');
        await expect(card.locator('[data-delta-mode="measured"]')).toBeVisible({ timeout: 15_000 });
        await expect(card.locator('.delta-path-list code').first()).toHaveText('kokpit/server.ts');
        await expect(card.getByText(TEST_PATH)).toBeVisible();

        const hit = page.locator('.map-flow-node.is-delta-hit[data-map-node-id="n_server"]');
        await expect(hit).toBeVisible();
        expect(await page.locator('.map-flow-node.is-delta-hit').count()).toBe(1);

        await page.locator('#tab-delta').click();
        const panelBody = page.locator('#deltaPanelBody');
        await expect(panelBody.locator('[data-delta-status="ready"]')).toBeVisible();
        await expect(panelBody).toContainText('Etkilenen kod');
        await expect(panelBody).toContainText('Etkilenen testler');
        await expect(panelBody.getByRole('region')).toHaveAttribute('aria-label', 'Delta kanıt paneli');
        await page.screenshot({ path: resolve(artifacts, 's1-measured-1440.png'), fullPage: true });
    });

    test('S3b · Ölçülmüş karşılaştırma: eklenen/kaldırılan kenarlar ayrı listelerde ölçülür', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { deltaSupplier: () => comparisonDelta() });
        await openWorkspace(page, 'Mock Proje');

        const details = await openPhaseItem(page, ITEM1_TEXT);
        const card = details.locator('[data-inspector-delta-card]');
        await expect(card.locator('[data-delta-mode="measured"]')).toBeVisible({ timeout: 15_000 });
        // İki liste başlığı da ayrı görünür; hiçbiri uydurma satır içermez.
        await expect(card.getByText('Eklenen kenarlar')).toBeVisible();
        await expect(card.getByText('Kaldırılan kenarlar')).toBeVisible();
        await expect(card).toContainText('n_parser → n_roadmap');
        await expect(card).toContainText('n_server → n_roadmap');
        const listed = card.locator('.delta-edge-list li');
        expect(await listed.count()).toBe(2);

        // Panel aynı dikişi aynalar (tek gerçeklik kaynağı deltaState).
        await dismissModalInspector(page);
        await page.locator('#tab-delta').click();
        const panelBody = page.locator('#deltaPanelBody');
        await expect(panelBody.locator('[data-delta-status="ready"]')).toBeVisible();
        await expect(panelBody).toContainText('Eklenen kenarlar');
        await expect(panelBody).toContainText('Kaldırılan kenarlar');
    });

    test('S2 · Yalnız-bildirim delta: kesikli ÖNERİ düğümü, uydurma kenar yok', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { deltaSupplier: () => declaredOnlyDelta() });
        await openWorkspace(page, 'Mock Proje');

        const details = await openPhaseItem(page, ITEM2_TEXT);
        const card = details.locator('[data-inspector-delta-card]');
        await expect(card.locator('[data-delta-section="proposed"]')).toBeVisible({ timeout: 15_000 });
        await expect(card).toContainText('henüz ölçülebilir değil');

        const proposed = page.locator('.map-flow-node.is-proposed');
        await expect(proposed.first()).toBeVisible();
        await expect(proposed.first()).toContainText('ÖNERİ');
        await expect(proposed.first()).toContainText('kokpit/planlar/yeni-modul.ts');
        expect(await page.locator('.map-flow-node.is-delta-hit').count()).toBe(0);
        expect(await card.locator('[data-delta-section="affected-code"]').count()).toBe(0);

        await page.locator('#tab-delta').click();
        const panelBody = page.locator('#deltaPanelBody');
        await expect(panelBody.locator('[data-delta-status="ready"]')).toBeVisible();
        await expect(panelBody).toContainText('Önerilen düğümler');
        await expect(panelBody).toContainText('henüz ölçülebilir değil');
        expect(await panelBody.locator('[data-delta-section="edges"]').count()).toBe(0);
        expect(await panelBody.locator('[data-delta-added-edge]').count()).toBe(0);
        await page.screenshot({ path: resolve(artifacts, 's2-declared-1440.png'), fullPage: true });
    });

    test('S4 · Bayat makbuz: kart yerine dürüst durum + yeniden indeks CTA', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { deltaSupplier: () => staleDelta() });
        await openWorkspace(page, 'Mock Proje');

        const details = await openPhaseItem(page, ITEM1_TEXT);
        const cardNote = details.locator('[data-inspector-delta-card]');
        await expect(cardNote).toContainText('Şimdi yeniden indeksle', { timeout: 15_000 });

        await page.locator('#tab-delta').click();
        const cta = page.locator('#deltaPanelBody [data-map-reindex="mock-proj"]');
        await expect(cta).toBeVisible();
        await expect(page.locator('#deltaPanelBody [data-delta-status="stale"]')).toBeVisible();

        const reindexRequest = page.waitForRequest(request =>
            request.method() === 'POST' && request.url().includes('/api/projects/mock-proj/reindex'));
        await cta.click();
        const request = await reindexRequest;
        expect(request.postDataBuffer()).toBeDefined();
        await expect(page.locator('#toast')).toContainText('yeniden indekslendi');
    });

    test('S5 · Proje nöbetçisi: geçişte delta dürüst boşa döner, vurgu kalkar', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, {
            projects: [projectRecord(), projectRecord({ id: 'proj-iki', name: 'Ikinci Proje' })],
            deltaSupplier: () => measuredDelta(),
        });
        await openWorkspace(page, 'Mock Proje');

        const details = await openPhaseItem(page, ITEM1_TEXT);
        await expect(details.locator('[data-inspector-delta-card] [data-delta-mode="measured"]')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('.map-flow-node.is-delta-hit[data-map-node-id="n_server"]')).toBeVisible();

        await page.locator('#projectSwitcher').click();
        await page.locator('[data-project-select="proj-iki"]').click();
        await expect(page.locator('#activeProjectName')).toHaveText('Ikinci Proje');

        await expect(page.locator('#view-delta[data-live="true"]')).toHaveCount(0);
        await expect(page.locator('.map-flow-node.is-delta-hit')).toHaveCount(0);
        await page.locator('#tab-delta').click();
        await expect(page.locator('#view-delta .delta-empty')).toBeVisible();
        const deltaText = await page.locator('#view-delta').innerText();
        expect(deltaText).not.toContain('kokpit/server.ts');
        await page.screenshot({ path: resolve(artifacts, 's5-switch-1440.png'), fullPage: true });
    });

    test('S6 · TR/EN paritesi: delta panelinde en az üç metin + aria-label döner', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { deltaSupplier: () => measuredDelta() });
        await openWorkspace(page, 'Mock Proje');

        const details = await openPhaseItem(page, ITEM1_TEXT);
        await expect(details.locator('[data-inspector-delta-card] [data-delta-mode="measured"]')).toBeVisible({ timeout: 15_000 });
        await page.locator('#tab-delta').click();
        const panelBody = page.locator('#deltaPanelBody');
        await expect(panelBody).toContainText('Etkilenen kod');
        await expect(panelBody.getByRole('region')).toHaveAttribute('aria-label', 'Delta kanıt paneli');

        await page.locator('#langEn').click();
        await expect(panelBody).toContainText('Affected code');
        await expect(panelBody).toContainText('Affected tests');
        await expect(panelBody).toContainText('These impacts come from the verified receipt mapping');
        await expect(panelBody.getByRole('region')).toHaveAttribute('aria-label', 'Delta evidence panel');
        await expect(page.locator('.primary-nav-button[data-section="projects"] span')).toHaveText('Projects');
        await page.screenshot({ path: resolve(artifacts, 's6-en-1440.png'), fullPage: true });
    });

    test('S7 · Klavye: çip → harita → madde gezinmesi ve Escape nöbetçisi', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { deltaSupplier: () => measuredDelta() });
        await openWorkspace(page, 'Mock Proje');

        const readCategory = () => page.evaluate(() => {
            const element = document.activeElement;
            if (!(element instanceof Element)) return '';
            if (element.closest('#phaseList')) return 'chip';
            if (element.matches('.phase-item summary')) return 'summary';
            if (element.hasAttribute('data-map-node-id')) return 'node';
            if (element.classList.contains('view-tab')) return 'tab';
            return '';
        });
        // DOM sırası: faz çipleri (rail) → harita düğümleri → denetçi maddeleri;
        // sekme turu sarmalaması view sekmelerine geri döndürür.
        // Faz madde listesini aç (summaries ancak faz render'ında var olur),
        // ardından DOM sırasını izleyerek gezin: çipler → harita düğümleri →
        // denetçi maddeleri; sekme turu sarmalaması view sekmelerine döner.
        await page.locator('#phaseList .phase-filter[data-phase="Dilim-0"]').click();
        await page.locator('#phaseList .phase-filter').first().focus();
        const seen: string[] = [];
        for (let step = 0; step < 120; step += 1) {
            await page.keyboard.press('Tab');
            const category = await readCategory();
            if (category && !seen.includes(category)) seen.push(category);
            if (seen.includes('summary') && seen.includes('node') && seen.includes('tab')) break;
        }
        expect(seen.filter(value => ['chip', 'node', 'summary'].includes(value)), `sıra: ${seen.join(' → ')}`)
            .toEqual(['chip', 'node', 'summary']);
        expect(seen).toContain('tab');

        // Dar kırılım: denetçi açıkken Escape kapatır ve odağı tetikleyen kontrole döner.
        await page.setViewportSize({ width: 1024, height: 768 });
        const chip = page.locator('#phaseList .phase-filter[data-phase="Dilim-0"]');
        await chip.click();
        await expect(page.locator('body')).toHaveClass(/inspector-open/);
        const summary = page.locator('.phase-item').filter({ hasText: ITEM1_TEXT }).locator('summary');
        await summary.click();
        await expect(page.locator('#inspectorBody')).toContainText('Etkilenen kod', { timeout: 15_000 });
        await page.keyboard.press('Escape');
        await expect(page.locator('body')).not.toHaveClass(/inspector-open/);
        await expect(chip).toBeFocused();
    });

    test('S8 · Üç kırılımda da delta paneli yatay taşma üretmez', async ({ page }) => {
        await installMocks(page, { deltaSupplier: () => measuredDelta() });
        for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024]] as const) {
            await page.setViewportSize({ width, height });
            await page.goto('/arayuz-onizleme.html');
            await expect(page.locator('#activeProjectName')).toHaveText('Mock Proje');
            await page.locator('.primary-nav-button[data-section="workspace"]').click();
            await waitForMap(page);
            const details = await openPhaseItem(page, ITEM1_TEXT);
            await expect(details.locator('[data-inspector-delta-card] [data-delta-mode="measured"]')).toBeVisible({ timeout: 15_000 });
            await dismissModalInspector(page);
            await page.locator('#tab-delta').click();
            await expect(page.locator('#deltaPanelBody [data-delta-status="ready"]')).toBeVisible();
            const overflow = await page.evaluate(() => ({
                scrollWidth: document.scrollingElement!.scrollWidth,
                innerWidth: window.innerWidth,
            }));
            expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
            await page.screenshot({ path: resolve(artifacts, `s8-${width}.png`), fullPage: true });
        }
    });
});
