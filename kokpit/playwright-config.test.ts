import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveE2eDataDir, shouldReuseE2eServer } from '../playwright.config';

describe('Playwright runtime isolation', () => {
    it('uses a run-scoped temporary registry unless an explicit data directory is supplied', () => {
        expect(resolveE2eDataDir(undefined, '/tmp', 'run-42')).toBe(resolve('/tmp', 'kokpit-pro-e2e-run-42'));
        expect(resolveE2eDataDir('/explicit/e2e-data', '/tmp', 'run-42')).toBe('/explicit/e2e-data');
    });

    it('never reuses a live server without an explicit opt-in', () => {
        expect(shouldReuseE2eServer(undefined)).toBe(false);
        expect(shouldReuseE2eServer('0')).toBe(false);
        expect(shouldReuseE2eServer('1')).toBe(true);
    });
});
