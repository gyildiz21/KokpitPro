import { expect, test } from '@playwright/test';

test('Dilim 6 · boş bulut kataloğu servis hatası değil, GitHub onboarding gösterir', async ({ page }) => {
    await page.route('**/api/health', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, mode: 'cloud', github: { mode: 'github-app', configured: true } }),
        }),
    );
    await page.route('**/api/projects', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ version: 1, activeProjectId: null, projects: [] }),
        }),
    );

    await page.goto('/arayuz-onizleme.html');

    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.locator('#projectList')).toContainText('Henüz proje yok');
    await expect(page.locator('#projectList')).toContainText('GitHub reposu ekle');
    await expect(page.locator('#projectList')).not.toContainText('Proje servisine bağlanılamadı');
    await expect(page.locator('#modeBadge')).toHaveText('Kurulum hazır');

    await page.locator('[data-empty-add-project]').click();
    await expect(page.locator('#connectDialog')).toBeVisible();
    await expect(page.locator('[data-connect-source="github"]')).toBeVisible();
    await expect(page.locator('[data-connect-source="local"]')).toHaveCount(0);
});
