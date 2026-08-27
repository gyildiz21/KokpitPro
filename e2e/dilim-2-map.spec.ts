import { mkdirSync } from 'node:fs';
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
});
