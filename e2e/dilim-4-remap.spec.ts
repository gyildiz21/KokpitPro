import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Dilim 4 · Kanıta dayalı remap öneri paneli — tamamen page.route maskeleriyle
// hermetik. Maskeler yalnız taşıyıcıdır: RemapReport v1 sözleşmesinin birebir
// şekli kullanılır, hiçbir yerde örnek öneri payload'ı sabitlemez. Panel
// Uygula/Taşı eylemi içermez; tek etkileşim kanıta iniş ve kopyalamadır.

const artifacts = resolve('output', 'playwright', 'dilim-4');
const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const TEST_PATH = 'kokpit/parser/__tests__/roadmap.test.ts';
const SERVER_PATH = 'kokpit/server.ts';
const PARSER_PATH = 'kokpit/parser/parser.ts';
const UNRENDERED_PATH = 'kokpit/planlar/yeni-modul.ts';

function planMarkdown(): string {
    return [
        '# Mock Plan',
        '',
        '## Dilim 0 · Motor',
        '',
        `- [x] **\`${SERVER_PATH}\` kabulü**: gerçek makbuz eşleşmesi`,
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
                heading: 'Dilim 0 · Motor',
                gateStatus: null,
                line: 3,
                items: [
                    { id: 'madde-1', title: `\`${SERVER_PATH}\` kabulü`, status: 'done', phaseHeading: 'Dilim 0 · Motor', line: 5 },
                    { id: 'madde-2', title: '`kokpit/planlar/yeni-modul.ts` eklenecek', status: 'open', phaseHeading: 'Dilim 0 · Motor', line: 6 },
                ],
            }],
            nodes: [
                { id: 'n_server', title: 'server.ts', path: SERVER_PATH, status: 'done', evidence: 'plan-path-match' },
                { id: 'n_parser', title: 'parser.ts', path: PARSER_PATH, status: 'partial', evidence: 'measured-import' },
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
                    { id: 'n_server', type: 'box', label: 'server.ts', path: SERVER_PATH, groupId: 'runtime' },
                    { id: 'n_parser', type: 'box', label: 'parser.ts', path: PARSER_PATH, groupId: 'analysis' },
                    { id: 'n_roadmap', type: 'box', label: 'roadmap.ts', path: 'kokpit/parser/roadmap.ts', groupId: 'analysis' },
                ],
                edges: [
                    { from: 'n_server', to: 'n_parser', label: 'imports' },
                    { from: 'n_server', to: 'n_roadmap', label: 'imports' },
                ],
            },
            nodeEvidence: {
                n_server: { ...receiptEvidence, path: SERVER_PATH, phaseHeading: 'Dilim 0 · Motor', itemId: 'Dilim 0 · Motor::madde-1', itemStatus: 'done', evidenceKind: 'plan-path-match', testPaths: [TEST_PATH] },
                n_parser: { ...receiptEvidence, path: PARSER_PATH, evidenceKind: 'measured-import', testPaths: [] },
                n_roadmap: { ...receiptEvidence, path: 'kokpit/parser/roadmap.ts', evidenceKind: 'measured-import', testPaths: [] },
            },
            measurements: { scannedFileCount: 3, totalEdgeCount: 2, renderedNodeCount: 3, renderedEdgeCount: 2, unresolvedCount: 0, durationMs: 5 },
            unmatchedPlanItems: [],
            itemMappings: { 'Dilim 0 · Motor::madde-1': { nodeIds: ['n_server'], paths: [SERVER_PATH], testPaths: [TEST_PATH] } },
        },
    };
}

/** RemapReport v1 taşıyıcıları — sözleşme şekli birebir, veri uydurmadır. */
function measuredRemap(projectId = 'mock-proj') {
    return {
        report: {
            version: 1,
            projectId,
            sourceRevision: COMMIT,
            generatedAt: new Date().toISOString(),
            measurement: 'measured',
            reasons: [],
            coverage: { eligibleFiles: 12, scannedFiles: 12, excludedFiles: 1, unresolvedImports: 0, renderedNodeCount: 3, truncated: false },
            suggestions: [
                {
                    id: 'remap-1',
                    kind: 'large-file',
                    targetPath: SERVER_PATH,
                    nodeId: 'n_server',
                    reasonCode: 'size-over-threshold',
                    metrics: { lines: 640, bytes: 21504 },
                    relatedPaths: [],
                    relatedGroups: [],
                    sourceRevision: COMMIT,
                    proposed: true,
                },
                {
                    id: 'remap-2',
                    kind: 'shared-import',
                    targetPath: PARSER_PATH,
                    nodeId: 'n_parser',
                    reasonCode: 'fan-in-over-threshold',
                    metrics: { importerFiles: 3, importerGroupCount: 2 },
                    relatedPaths: [SERVER_PATH, 'kokpit/parser/roadmap.ts'],
                    relatedGroups: ['analysis'],
                    sourceRevision: COMMIT,
                    proposed: true,
                },
                {
                    id: 'remap-3',
                    kind: 'cross-layer-placement-review',
                    targetPath: UNRENDERED_PATH,
                    reasonCode: 'placement-review-multi-group',
                    metrics: { foreignGroupCount: 2 },
                    relatedPaths: [],
                    relatedGroups: [],
                    sourceRevision: COMMIT,
                    proposed: true,
                },
            ],
            truncated: false,
        },
    };
}

function emptyMeasuredRemap(projectId = 'mock-proj') {
    const payload = measuredRemap(projectId);
    payload.report.suggestions = [];
    return payload;
}

function unmeasurableRemap(projectId = 'mock-proj', code = 'stale-receipt') {
    return {
        report: {
            version: 1,
            projectId,
            sourceRevision: COMMIT,
            generatedAt: new Date().toISOString(),
            measurement: 'unmeasurable',
            reasons: [{ code, message: `carrier reason: ${code}` }],
            coverage: { eligibleFiles: 0, scannedFiles: 0, excludedFiles: 0, unresolvedImports: 0, renderedNodeCount: 0, truncated: false },
            suggestions: [],
            truncated: false,
        },
    };
}

interface MockOptions {
    readonly projects?: ReturnType<typeof projectRecord>[];
    readonly remapSupplier?: (projectId: string) => unknown;
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
        await page.route(`**/api/projects/${record.id}/remap`, route => route.fulfill({
            json: options.remapSupplier ? options.remapSupplier(record.id) : measuredRemap(record.id),
        }));
    }
    await page.route('**/api/projects/*/delta*', route => route.fulfill({ json: { delta: null } }));
}

async function waitForMap(page: Page): Promise<void> {
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 });
}

async function openWorkspace(page: Page, projectName: string): Promise<void> {
    await page.goto('/arayuz-onizleme.html');
    await expect(page.locator('#activeProjectName')).toHaveText(projectName, { timeout: 30_000 });
    await page.locator('.primary-nav-button[data-section="workspace"]').click();
    await waitForMap(page);
}

/** Paneli açar ve ölçülmüş kartların gelmesini bekler. */
async function openRemapPanel(page: Page): Promise<void> {
    await page.locator('#remapToggle').click();
    await expect(page.locator('#remapPanel')).toBeVisible();
    await expect(page.locator('#remapPanel .remap-engine')).not.toHaveText('', { timeout: 15_000 });
}

test.beforeAll(() => { mkdirSync(artifacts, { recursive: true }); });

test.describe('Dilim 4 remap öneri paneli (hermetik maskeler)', () => {

    test('S1 · Gerçek ölçülmüş liste: üç kart, ÖNERİ rozeti, metrik/yol/revision ve kapsam', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { remapSupplier: projectId => measuredRemap(projectId) });
        await openWorkspace(page, 'Mock Proje');
        await openRemapPanel(page);

        const panel = page.locator('#remapPanel');
        await expect(panel.locator('[data-remap-card]')).toHaveCount(3);
        const badges = panel.locator('[data-remap-card] .map-flow-node__badge');
        await expect(badges).toHaveText(['ÖNERİ', 'ÖNERİ', 'ÖNERİ']);

        const largeCard = panel.locator('[data-remap-card="remap-1"]');
        await expect(largeCard).toContainText(SERVER_PATH);
        await expect(largeCard).toContainText('size-over-threshold');
        await expect(largeCard).toContainText('640');
        await expect(largeCard).toContainText('satır');
        await expect(largeCard).toContainText('a1b2c3d4');

        const sharedCard = panel.locator('[data-remap-card="remap-2"]');
        await expect(sharedCard).toContainText(PARSER_PATH);
        await expect(sharedCard).toContainText('fan-in-over-threshold');
        await expect(sharedCard.getByText(SERVER_PATH)).toBeVisible();

        await expect(panel).toContainText('Kapsam: 12/12');
        await expect(panel).toContainText('Öneri insan incelemesi içindir');
        await expect(panel.locator('.remap-engine')).toContainText('Ölçümlü remap raporu');
        await page.screenshot({ path: resolve(artifacts, 's1-measured-1440.png'), fullPage: true });
    });

    test('S2 · Kanıta iniş: karttan tek tıkla harita düğümü seçilir ve vurgulanır', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { remapSupplier: projectId => measuredRemap(projectId) });
        await openWorkspace(page, 'Mock Proje');
        await openRemapPanel(page);

        // Panel açıldıktan sonra en fazla bir tık: kart içi iniş düğmesi.
        // Harita düğümü odağı alır ve denetçi seçimi kanıtlar (select → is-selected
        // kontrollü nodes prop'u yüzünden kalıcı değil; odak kanıtı nöbetçidir).
        await page.locator('[data-remap-card="remap-1"] [data-node-jump="n_server"]').click();
        const node = page.locator('[data-map-node-id="n_server"]');
        await expect(node).toBeFocused();
        await expect(page.locator('#inspectorBody .detail-title')).toHaveText('server.ts');
        await expect(page.locator('#inspectorBody .detail-path')).toHaveText(SERVER_PATH);
    });

    test('S3 · Harita dışı ölçülmüş hedef: iniş düğmesi yok, dürüst not görünür', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { remapSupplier: projectId => measuredRemap(projectId) });
        await openWorkspace(page, 'Mock Proje');
        await openRemapPanel(page);

        const unrenderedCard = page.locator('[data-remap-card="remap-3"]');
        await expect(unrenderedCard).toContainText('Ölçüldü, haritada render edilmedi.');
        await expect(unrenderedCard).toContainText(UNRENDERED_PATH);
        expect(await unrenderedCard.locator('[data-node-jump]').count()).toBe(0);
    });

    test('S4 · Dürüst önerisiz durum: temiz-repo iddiası yok, kapsam sayıları görünür', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { remapSupplier: projectId => emptyMeasuredRemap(projectId) });
        await openWorkspace(page, 'Mock Proje');
        await openRemapPanel(page);

        const panel = page.locator('#remapPanel');
        await expect(panel).toContainText('Bu revizyonda öneri üretilmedi');
        await expect(panel).toContainText('Eşik altı veri temiz repo anlamına gelmez');
        await expect(panel).toContainText('Kapsam: 12/12');
        expect(await panel.locator('[data-remap-card]').count()).toBe(0);
        const panelText = await panel.innerText();
        expect(panelText.toLowerCase()).not.toContain('temiz repo onaylandı');
        await page.screenshot({ path: resolve(artifacts, 's4-empty-1440.png'), fullPage: true });
    });

    test('S5 · Bayat makbuz: kart yok, yeniden indeks CTA çalışır ve bildirim çıkar', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { remapSupplier: projectId => unmeasurableRemap(projectId, 'stale-receipt') });
        await openWorkspace(page, 'Mock Proje');
        await openRemapPanel(page);

        const panel = page.locator('#remapPanel');
        await expect(panel.locator('[data-remap-status="unmeasurable"]')).toBeVisible();
        await expect(panel).toContainText('Makbuz bayat');
        expect(await panel.locator('[data-remap-card]').count()).toBe(0);

        const cta = panel.locator('[data-map-reindex="mock-proj"]');
        await expect(cta).toBeVisible();
        const reindexRequest = page.waitForRequest(request =>
            request.method() === 'POST' && request.url().includes('/api/projects/mock-proj/reindex'));
        await cta.click();
        const request = await reindexRequest;
        expect(request.postDataBuffer()).toBeDefined();
        await expect(page.locator('#toast')).toContainText('yeniden indekslendi');
    });

    test('S5b · Ölçüm sırasında revision değişimi: eski kanıt çizilmez ve yeniden indeks sunulur', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { remapSupplier: projectId => unmeasurableRemap(projectId, 'revision-changed-during-scan') });
        await openWorkspace(page, 'Mock Proje');
        await openRemapPanel(page);

        const panel = page.locator('#remapPanel');
        await expect(panel.locator('[data-remap-status="unmeasurable"]')).toBeVisible();
        await expect(panel).toContainText('Ölçüm sırasında çalışma ağacı değişti');
        await expect(panel).toContainText('revision-changed-during-scan');
        await expect(panel.locator('[data-map-reindex="mock-proj"]')).toBeVisible();
        await expect(panel.locator('[data-remap-card]')).toHaveCount(0);
    });

    test('S6 · no-local-checkout: dürüst ölçemezlik, yeniden indeks düğmesi YOK', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { remapSupplier: projectId => unmeasurableRemap(projectId, 'no-local-checkout') });
        await openWorkspace(page, 'Mock Proje');
        await openRemapPanel(page);

        const panel = page.locator('#remapPanel');
        await expect(panel.locator('[data-remap-status="unmeasurable"]')).toBeVisible();
        await expect(panel).toContainText('Yerel checkout yok');
        await expect(panel).toContainText('yerel checkout\'u yok');
        expect(await panel.locator('[data-map-reindex]').count()).toBe(0);
        expect(await panel.locator('[data-remap-card]').count()).toBe(0);
        await page.screenshot({ path: resolve(artifacts, 's6-no-checkout-1440.png'), fullPage: true });
    });

    test('S7 · Proje değişimi: panel sıfırlanır, önceki projenin hedefi kaybolur', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, {
            projects: [projectRecord(), projectRecord({ id: 'proj-iki', name: 'Ikinci Proje' })],
            remapSupplier: projectId => projectId === 'proj-iki'
                ? unmeasurableRemap(projectId, 'no-local-checkout')
                : measuredRemap(projectId),
        });
        await openWorkspace(page, 'Mock Proje');
        await openRemapPanel(page);
        await expect(page.locator('[data-remap-card="remap-1"]')).toContainText(SERVER_PATH);

        await page.locator('#projectSwitcher').click();
        await page.locator('[data-project-select="proj-iki"]').click();
        await expect(page.locator('#activeProjectName')).toHaveText('Ikinci Proje', { timeout: 30_000 });

        // resetRemapPanel paneli kapatıp içerğini siler: A'nın hedefi artık yok.
        await expect(page.locator('#remapPanel')).toBeHidden();
        expect(await page.locator('#remapPanel').innerText().then(text => text.includes(SERVER_PATH))).toBe(false);
        await expect(page.locator('#remapToggle')).toHaveAttribute('aria-pressed', 'false');

        // B projesi için panel yeniden açılınca dürüst ölçemezlik durumu gelir.
        await openRemapPanel(page);
        const panel = page.locator('#remapPanel');
        await expect(panel.locator('[data-remap-status="unmeasurable"]')).toBeVisible();
        const panelText = await panel.innerText();
        expect(panelText).not.toContain(SERVER_PATH);
        await page.screenshot({ path: resolve(artifacts, 's7-switch-1440.png'), fullPage: true });
    });

    test('S8 · TR/EN: panel başlığı, gerekçe etiketi ve aria-label döner', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { remapSupplier: projectId => unmeasurableRemap(projectId, 'stale-receipt') });
        await openWorkspace(page, 'Mock Proje');
        await openRemapPanel(page);

        const panel = page.locator('#remapPanel');
        await expect(panel.locator('.remap-head strong')).toHaveText('Yeniden düzenleme önerileri');
        await expect(panel).toContainText('Makbuz bayat');
        await expect(page.locator('#remapPanel')).toHaveAttribute('aria-label', 'Remap öneri paneli');

        await page.locator('#langEn').click();
        await expect(panel.locator('.remap-head strong')).toHaveText('Restructuring suggestions');
        await expect(panel).toContainText('Stale receipt');
        await expect(panel.locator('.remap-engine')).toContainText('Remap could not be measured');
        await expect(page.locator('#remapPanel')).toHaveAttribute('aria-label', 'Remap suggestion panel');
        await page.screenshot({ path: resolve(artifacts, 's8-en-1440.png'), fullPage: true });
    });

    test('S9 · Klavye: Enter ile açılır, odak panele iner, Escape kapatır ve odağı döndürür', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { remapSupplier: projectId => measuredRemap(projectId) });
        await openWorkspace(page, 'Mock Proje');

        const toggle = page.locator('#remapToggle');
        await toggle.focus();
        await page.keyboard.press('Enter');
        const panel = page.locator('#remapPanel');
        await expect(panel).toBeVisible();
        await expect(panel.locator('[data-remap-card="remap-1"]')).toBeVisible({ timeout: 15_000 });
        await expect.poll(() => page.evaluate(() =>
            document.activeElement instanceof Element && document.activeElement.closest('#remapPanel') != null,
        )).toBe(true);

        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
        await expect(toggle).toBeFocused();
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    test('S10 · Üç kırılım (1440/1024/768): panel açıkken yatay taşma yok', async ({ page }) => {
        await installMocks(page, { remapSupplier: projectId => measuredRemap(projectId) });
        for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024]] as const) {
            await page.setViewportSize({ width, height });
            await page.goto('/arayuz-onizleme.html');
            await expect(page.locator('#activeProjectName')).toHaveText('Mock Proje', { timeout: 30_000 });
            await page.locator('.primary-nav-button[data-section="workspace"]').click();
            await waitForMap(page);
            await openRemapPanel(page);
            await expect(page.locator('[data-remap-card="remap-1"]')).toBeVisible({ timeout: 15_000 });
            const overflow = await page.evaluate(() => ({
                scrollWidth: document.scrollingElement!.scrollWidth,
                innerWidth: window.innerWidth,
            }));
            expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
            await page.screenshot({ path: resolve(artifacts, `s10-${width}.png`), fullPage: true });
        }
    });

    test('S11 · Uygula/Taşı yokluğu: öneri panelinde otomatik değişiklik eylemi bulunmaz', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await installMocks(page, { remapSupplier: projectId => measuredRemap(projectId) });
        await openWorkspace(page, 'Mock Proje');
        await openRemapPanel(page);

        await expect(page.locator('[data-remap-apply]')).toHaveCount(0);
        await expect(page.locator('[data-remap-move]')).toHaveCount(0);
        await expect(page.locator('#remapPanel button').filter({ hasText: 'Uygula' })).toHaveCount(0);
        await expect(page.locator('#remapPanel button').filter({ hasText: 'Taşı' })).toHaveCount(0);
        const buttons = page.locator('#remapPanel button');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
        await page.screenshot({ path: resolve(artifacts, 's11-no-apply-1440.png'), fullPage: true });
    });
});
