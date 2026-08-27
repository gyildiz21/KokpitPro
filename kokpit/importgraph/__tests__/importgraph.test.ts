import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { scanImportGraph } from '../scan';
import type { ImportScanResult } from '../scan';

function fixtureRoot(name: string): string {
    return fileURLToPath(new URL(`../__fixtures__/importgraph/${name}`, import.meta.url));
}

function withoutDuration(result: ImportScanResult): Omit<ImportScanResult, 'durationMs'> {
    const { durationMs: _durationMs, ...rest } = result;
    void _durationMs;
    return rest;
}

describe('scanImportGraph', () => {
    it('static-import: a.ts -> b.ts kenarını gerçek çıkarır', async () => {
        const result = await scanImportGraph({ rootDir: fixtureRoot('static-import') });

        expect(result.scannedFileCount).toBe(2);
        expect(result.nodes).toEqual([{ path: 'a.ts' }, { path: 'b.ts' }]);
        expect(result.edges).toEqual([
            { from: 'a.ts', to: 'b.ts', resolved: true, dynamic: false, typeOnly: false, raw: './b' },
        ]);
        expect(result.unresolvedCount).toBe(0);
    });

    it('dynamic-import: await import() kenarını dynamic olarak işaretler', async () => {
        const result = await scanImportGraph({ rootDir: fixtureRoot('dynamic-import') });

        expect(result.nodes.map((node) => node.path)).toEqual(['a.ts', 'b.ts']);
        expect(result.edges).toEqual([
            { from: 'a.ts', to: 'b.ts', resolved: true, dynamic: true, typeOnly: false, raw: './b' },
        ]);
        expect(result.unresolvedCount).toBe(0);
    });

    it('type-only: import type kenarı typeOnly=true ile sayılır', async () => {
        const result = await scanImportGraph({ rootDir: fixtureRoot('type-only') });

        expect(result.edges).toEqual([
            { from: 'a.ts', to: 'types.ts', resolved: true, dynamic: false, typeOnly: true, raw: './types' },
        ]);
        expect(result.unresolvedCount).toBe(0);
    });

    it('index-resolution: ./utils hedefi utils/index.ts olarak çözümlenir', async () => {
        const result = await scanImportGraph({ rootDir: fixtureRoot('index-resolution') });

        expect(result.nodes.map((node) => node.path)).toEqual(['a.ts', 'utils/index.ts']);
        expect(result.edges).toEqual([
            { from: 'a.ts', to: 'utils/index.ts', resolved: true, dynamic: false, typeOnly: false, raw: './utils' },
        ]);
    });

    it('alias-resolution: fixture tsconfig paths (@x/*) kökü içinde çözülür', async () => {
        const result = await scanImportGraph({ rootDir: fixtureRoot('alias-resolution') });

        expect(result.unresolvedCount).toBe(0);
        expect(result.nodes.map((node) => node.path).sort()).toEqual(['a.js', 'src/greet.ts']);
        expect(result.edges).toEqual([
            { from: 'a.js', to: 'src/greet.ts', resolved: true, dynamic: false, typeOnly: false, raw: '@x/greet' },
        ]);
    });

    it('unresolved: var olmayan paket hata fırlatmadan resolved:false sayılır', async () => {
        const result = await scanImportGraph({ rootDir: fixtureRoot('unresolved') });

        expect(result.scannedFileCount).toBe(1);
        expect(result.nodes).toEqual([{ path: 'a.js' }]);
        expect(result.edges).toEqual([
            {
                from: 'a.js',
                to: null,
                resolved: false,
                dynamic: false,
                typeOnly: false,
                raw: 'a-missing-npm-package-for-fixture',
            },
        ]);
        expect(result.unresolvedCount).toBe(1);
    });

    it('Node çekirdek modüllerini repo dosyası gibi düğümleştirmez', async () => {
        const result = await scanImportGraph({ rootDir: fixtureRoot('core-module') });
        expect(result.nodes).toEqual([{ path: 'a.ts' }]);
        expect(result.edges).toEqual([
            { from: 'a.ts', to: null, resolved: true, dynamic: false, typeOnly: false, raw: 'path' },
        ]);
    });

    it('excluded-folders: varsayılan hariç tutulan dist/ düğüm ne kenar üretir', async () => {
        const result = await scanImportGraph({ rootDir: fixtureRoot('excluded-folders') });

        expect(result.scannedFileCount).toBe(1);
        expect(result.nodes).toEqual([{ path: 'a.ts' }]);
        expect(result.edges).toEqual([]);
        expect(result.unresolvedCount).toBe(0);
    });

    it('iki koşum deterministiktir (durationMs hariç)', async () => {
        const first = await scanImportGraph({ rootDir: fixtureRoot('alias-resolution') });
        const second = await scanImportGraph({ rootDir: fixtureRoot('alias-resolution') });

        expect(withoutDuration(first)).toEqual(withoutDuration(second));
    });

    it.each([
        'static-import',
        'dynamic-import',
        'type-only',
        'index-resolution',
        'alias-resolution',
        'unresolved',
        'excluded-folders',
        'core-module',
    ])('%s: makullük kontrolleri — sıralı, tekil, pozitif sayımlar', async (name) => {
        const result = await scanImportGraph({ rootDir: fixtureRoot(name) });

        expect(result.scannedFileCount).toBeGreaterThan(0);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.scannedFileCount).toBe(result.nodes.length);

        const paths = result.nodes.map((node) => node.path);
        expect(paths).toEqual([...paths].sort());
        expect(new Set(paths).size).toBe(paths.length);
    });

    it('var olmayan rootDir için açıklayıcı Error fırlatır', async () => {
        await expect(scanImportGraph({ rootDir: fixtureRoot('no-such-fixture') })).rejects.toThrow(/does not exist/u);
    });

    it('göreli rootDir reddedilir', async () => {
        await expect(scanImportGraph({ rootDir: './kokpit/importgraph' })).rejects.toThrow(/absolute/u);
    });
});
