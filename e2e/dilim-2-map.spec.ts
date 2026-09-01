import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const artifacts = resolve('output', 'playwright');

async function openKokpitWorkspace(page: Page): Promise<void> {
    await page.goto('/arayuz-onizleme.html');
    // Katalog satırları ilk kayıt renderında görünür olabilir; uygulama-hazır
    // durumu başlangıçtaki plan+diyagram yüklemesinin gerçekten bittiği kapıdır.
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true', { timeout: 90_000 });
    await expect(page.locator('#previewGenerated')).toContainText('projectId:');
    const kokpitRow = page.locator('[data-project-row]').filter({ hasText: 'KokpitPro' });
    await expect(kokpitRow).toBeVisible();
    if ((await page.locator('#activeProjectName').textContent())?.trim() === 'KokpitPro') {
        await page.locator('.primary-nav-button[data-section="workspace"]').click();
    } else {
        await kokpitRow.locator('[data-project-open]').click();
    }
    await expect(page.locator('#activeProjectName')).toHaveText('KokpitPro');
    await expect(page.locator('#workspaceScreen')).toBeVisible();
    const reindex = page.locator('[data-map-reindex]');
    await expect(reindex.or(page.locator('.react-flow'))).toBeVisible({ timeout: 30_000 });
    if (await reindex.isVisible().catch(() => false)) await reindex.click();
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 90_000 });
}

test('Dilim 2 gerçek harita, dil, klavye ve duyarlı yerleşim kabulü', async ({ page }) => {
    mkdirSync(artifacts, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openKokpitWorkspace(page);

    const nodes = page.locator('.map-flow-node');
    await expect(nodes.first()).toBeVisible();
    expect(await nodes.count()).toBeGreaterThanOrEqual(3);
    await expect(nodes.filter({ hasText: /__tests__|__fixtures__|\.test\./i })).toHaveCount(0);
    const groups = page.locator('.map-flow-group');
    expect(await groups.count()).toBeGreaterThanOrEqual(2);
    const edgePaths = page.locator('.react-flow__edge-path');
    expect(await edgePaths.count()).toBeGreaterThan(0);
    expect(await edgePaths.evaluateAll((paths) => paths.some((path) => path.getBoundingClientRect().width > 0 || path.getBoundingClientRect().height > 0))).toBe(true);
    expect(await page.locator('.react-flow__edge.is-labeled').count()).toBeGreaterThan(0);

    // Dilim 2.3: grup denetçisi gerçek ölçülmüş graf üstünden açılır ve aynı
    // makbuzla sayfa dönüşünde seçim + viewport korunur.
    const firstGroup = page.locator('[data-map-group-id]').first();
    const groupClickPoint = await firstGroup.evaluate((group) => {
        const box = group.getBoundingClientRect();
        const left = Math.max(0, Math.ceil(box.left + 4));
        const right = Math.min(window.innerWidth - 1, Math.floor(box.right - 4));
        const top = Math.max(0, Math.ceil(box.top + 4));
        const bottom = Math.min(window.innerHeight - 1, Math.floor(box.bottom - 4));
        for (let y = top; y <= bottom; y += 8) {
            for (let x = left; x <= right; x += 8) {
                const target = document.elementFromPoint(x, y);
                if (target === group || (target && group.contains(target))) return { x, y };
            }
        }
        return null;
    });
    expect(groupClickPoint, 'Grup yüzeyinde gerçek işaretçi tıklamasına açık bir nokta olmalıdır.').not.toBeNull();
    if (!groupClickPoint) throw new Error('Group surface has no pointer-accessible point.');
    await page.mouse.click(groupClickPoint.x, groupClickPoint.y);
    await expect(page.locator('#inspectorBody')).toContainText('Deterministik sorumluluk');
    await page.locator('#mapSearch').fill('map-flow');
    await expect(page.locator('#mapCount')).toContainText('arama sonucu');
    expect(await page.locator('.map-flow-node.is-dimmed').count()).toBeGreaterThan(0);
    const viewportBeforeZoom = await page.evaluate(() => (window as any).KokpitMapFlow?.getViewport?.());
    // Büyük graf fitView'i minZoom tabanına (0.25) indirebilir; tek adım tam
    // +0.05 ürettiği için artış iddiası iki gerçek zoomIn adımıyla kurulur.
    await page.evaluate(() => (window as any).KokpitMapFlow?.zoomIn());
    await page.evaluate(() => (window as any).KokpitMapFlow?.zoomIn());
    await expect.poll(() => page.evaluate(() => (window as any).KokpitMapFlow?.getViewport?.()?.zoom ?? 0))
        .toBeGreaterThan(viewportBeforeZoom?.zoom ?? 0);
    const viewportBeforeReload = await page.evaluate(() => (window as any).KokpitMapFlow?.getViewport());
    await expect.poll(() => page.evaluate(() => {
        for (const key of Object.keys(sessionStorage)) {
            if (!key.startsWith('kokpit-map-state:')) continue;
            const state = JSON.parse(sessionStorage.getItem(key) || '{}');
            if (state.selection?.type === 'group') return state.viewport?.zoom ?? null;
        }
        return null;
    })).toBeCloseTo(viewportBeforeReload?.zoom ?? 1, 1);
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true', { timeout: 90_000 });
    await page.locator('.primary-nav-button[data-section="workspace"]').click();
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#inspectorBody')).toContainText('Deterministik sorumluluk');
    await expect(page.locator('#mapSearch')).toHaveValue('map-flow');
    await expect.poll(() => page.evaluate(() => (window as any).KokpitMapFlow?.getViewport?.()?.zoom ?? 0))
        .toBeCloseTo(viewportBeforeReload?.zoom ?? 1, 1);
    const viewportAfterReload = await page.evaluate(() => (window as any).KokpitMapFlow?.getViewport());
    expect(viewportAfterReload?.zoom).toBeCloseTo(viewportBeforeReload?.zoom ?? 1, 1);
    await page.locator('#mapSearch').fill('');

    // Kenar denetçisi yalnız graf sözleşmesindeki ölçülmüş import kaydını açar.
    await page.locator('.react-flow__edge-interaction').first().click({ force: true });
    await expect(page.locator('#inspectorBody')).toContainText('Import kanıtı');

    const rectangles = await nodes.evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }));
    for (let left = 0; left < rectangles.length; left += 1) {
        for (let right = left + 1; right < rectangles.length; right += 1) {
            const a = rectangles[left]!;
            const b = rectangles[right]!;
            const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            expect(overlaps).toBe(false);
        }
    }
    await page.screenshot({ path: resolve(artifacts, 'kokpit-map-1440.png'), fullPage: true });

    // Dilim 3: maskesiz gerçek sunucu + gerçek indeks + gerçek delta API/UI turu.
    await page.locator('#phaseList .phase-filter[data-phase="Dilim-1"]').click();
    const roadmapItem = page.locator('#inspectorBody .phase-item').filter({ hasText: 'kokpit/parser/roadmap.ts' }).first();
    await roadmapItem.locator('summary').click();
    await expect(roadmapItem.locator('[data-inspector-delta-card] [data-delta-mode="measured"]')).toBeVisible({ timeout: 30_000 });
    await expect(roadmapItem).toContainText('kokpit/parser/__tests__/roadmap.test.ts');

    await page.setViewportSize({ width: 1024, height: 820 });
    await nodes.first().focus();
    const firstId = await nodes.first().getAttribute('data-map-node-id');
    await page.keyboard.press('ArrowRight');
    const movedId = await page.evaluate(() => document.activeElement?.getAttribute('data-map-node-id'));
    expect(movedId).not.toBe(firstId);
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveClass(/inspector-open/);
    await expect(page.locator('#inspectorClose')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/inspector-open/);
    await expect(page.locator(`[data-map-node-id="${movedId}"]`)).toBeFocused();

    await page.locator('#langEn').click();
    await expect(page.locator('#inspectorHeading')).toHaveText('Inspector');
    await expect(page.locator('.react-flow')).toHaveAttribute('aria-label', 'Measured repository dependency map');
    await page.screenshot({ path: resolve(artifacts, 'kokpit-map-1024-en.png'), fullPage: true });

    await page.setViewportSize({ width: 768, height: 760 });
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    if (await page.locator('body').evaluate((body) => body.classList.contains('inspector-open'))) await page.keyboard.press('Escape');
    await page.locator('#langTr').click();
    if (await page.locator('body').evaluate((body) => body.classList.contains('inspector-open'))) await page.keyboard.press('Escape');
    await page.locator('#phaseList .phase-filter[data-phase="Dilim-2"]').click();
    await expect(page.locator('#inspectorBody')).toContainText('Kod kanıtı');
    const dimmedCount = await page.locator('.map-flow-node.is-dimmed').count();
    expect(dimmedCount).toBeGreaterThan(0);
    expect(dimmedCount).toBeLessThan(await nodes.count());
    await page.locator('#inspectorBody .phase-item summary').first().click();
    await expect(page.locator('#inspectorBody')).toContainText('Doğrulanmış kod yolu');
    await page.screenshot({ path: resolve(artifacts, 'kokpit-map-768-phase.png'), fullPage: true });

    await page.keyboard.press('Escape');
    await page.locator('#phaseList .phase-filter[data-phase="Dilim-5"]').click();
    await expect(page.locator('.map-flow-node.is-dimmed')).toHaveCount(0);
    await expect(page.locator('#phaseList .phase-filter[data-phase="Dilim-5.2"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/inspector-open/);
    await page.locator('#phaseList .phase-filter[data-phase="Dilim-5.2"]').click();
    await expect(page.locator('#inspectorBody')).toContainText('Gerçek Korpus Karar Bütünlüğü');
});

test('Dilim 2.3 tek güncellik gerçeği katalog ve diyagramda aynıdır', async ({ page, request }) => {
    const repository = mkdtempSync(resolve(tmpdir(), 'kokpit-freshness-e2e-'));
    const projectName = `Freshness ${Date.now()}`;
    const git = (...args: string[]) => execFileSync('git', ['-C', repository, ...args], { stdio: 'ignore' });
    let projectId = '';
    try {
        git('init', '-b', 'main');
        writeFileSync(resolve(repository, 'PLAN.md'), '# Plan\n\n## Dilim 1\n\n- [x] `src.ts` ölçümü\n');
        writeFileSync(resolve(repository, 'src.ts'), 'export const value = 1;\n');
        git('add', '.');
        git('-c', 'user.name=Kokpit Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture');

        const created = await request.post('/api/projects/local', { data: { path: repository, planPath: 'PLAN.md', name: projectName } });
        const createdBody = await created.text();
        expect(created.ok(), createdBody).toBe(true);
        const registry = JSON.parse(createdBody);
        projectId = registry.projects.find((project: { name: string }) => project.name === projectName)?.id ?? '';
        expect(projectId).not.toBe('');

        writeFileSync(resolve(repository, 'src.ts'), 'export const value = 2;\n');
        const liveRegistry = await (await request.get('/api/projects')).json();
        expect(liveRegistry.projects.find((project: { id: string }) => project.id === projectId)?.connectionState).toBe('stale');
        const diagram = await (await request.get(`/api/projects/${encodeURIComponent(projectId)}/diagram`)).json();
        expect(diagram).toMatchObject({ measurable: false, reason: 'stale-receipt' });

        await page.goto('/arayuz-onizleme.html');
        const row = page.locator('[data-project-row]').filter({ hasText: projectName });
        await expect(row).toContainText('Bayat indeks');

        const reindexed = await request.post(`/api/projects/${encodeURIComponent(projectId)}/reindex`, { data: {} });
        expect(reindexed.ok()).toBe(true);
        const delta = await (await request.get(`/api/projects/${encodeURIComponent(projectId)}/delta?phase=${encodeURIComponent('Dilim 1')}&item=madde-1`)).json();
        expect(delta.delta.mode).toBe('measured');
        expect(delta.delta.reasons.map((reason: { code: string }) => reason.code)).not.toContain('comparison-baseline-unavailable');
    } finally {
        if (projectId) await request.delete(`/api/projects/${encodeURIComponent(projectId)}`).catch(() => undefined);
        rmSync(repository, { recursive: true, force: true });
    }
});
