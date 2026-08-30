// measureProductionFileStats nöbetçi testleri — Dilim 4.
//
// Kök-içi realpath güvenliği, kök-dışı symlink reddi, 8 MiB satır eşiği ve
// okunamayan dosya muhasebesi hermetik geçici dizinlerde sabitlenir.

import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measureProductionFileStats } from '../measure';

const tempRoots: string[] = [];

function makeTempRoot(prefix = 'remap-measure-'): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tempRoots.push(dir);
    return dir;
}

afterAll(() => {
    for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

describe('measureProductionFileStats', () => {
    it('satır ve baytları ölçer; sondaki satır sonu ve boş dosya dürüst sayılır', () => {
        const root = makeTempRoot();
        mkdirSync(join(root, 'sub', 'deep'), { recursive: true });
        writeFileSync(join(root, 'a.ts'), 'l1\nl2\nl3\n', 'utf8');
        writeFileSync(join(root, 'no-newline.ts'), 'x\ny', 'utf8');
        writeFileSync(join(root, 'empty.ts'), '', 'utf8');
        writeFileSync(join(root, 'sub', 'deep', 'b.ts'), 'a\nb\nc', 'utf8');

        const { stats, unreadable, outsideRoot } = measureProductionFileStats(root, [
            'a.ts',
            'no-newline.ts',
            'empty.ts',
            'sub/deep/b.ts',
        ]);

        expect(unreadable).toBe(0);
        expect(outsideRoot).toBe(0);
        expect(stats.get('a.ts')).toEqual({ path: 'a.ts', lines: 3, bytes: 9 });
        expect(stats.get('no-newline.ts')).toEqual({ path: 'no-newline.ts', lines: 2, bytes: 3 });
        expect(stats.get('empty.ts')).toEqual({ path: 'empty.ts', lines: 0, bytes: 0 });
        expect(stats.get('sub/deep/b.ts')).toEqual({ path: 'sub/deep/b.ts', lines: 3, bytes: 5 });
    });

    it('okunamayan yol unreadable sayılır ve stats haricine girmez', () => {
        const root = makeTempRoot();
        writeFileSync(join(root, 'real.ts'), 'ok\n', 'utf8');

        const { stats, unreadable, outsideRoot } = measureProductionFileStats(root, ['real.ts', 'missing.ts']);

        expect(unreadable).toBe(1);
        expect(outsideRoot).toBe(0);
        expect([...stats.keys()]).toEqual(['real.ts']);
    });

    it('kök dışına çözülen symlink reddedilir; kök içi symlink kabul edilir', () => {
        const root = makeTempRoot();
        const outsideDir = makeTempRoot('remap-measure-outside-');
        writeFileSync(join(outsideDir, 'secret.ts'), 'hidden\n', 'utf8');
        writeFileSync(join(root, 'inner.ts'), 'inner\n', 'utf8');
        symlinkSync(join(outsideDir, 'secret.ts'), join(root, 'outside-link.ts'));
        symlinkSync(join(root, 'inner.ts'), join(root, 'inside-link.ts'));

        const { stats, unreadable, outsideRoot } = measureProductionFileStats(root, [
            'outside-link.ts',
            'inside-link.ts',
        ]);

        expect(outsideRoot).toBe(1);
        expect(unreadable).toBe(0);
        expect(stats.has('outside-link.ts')).toBe(false);
        expect(stats.get('inside-link.ts')).toEqual({ path: 'inside-link.ts', lines: 1, bytes: 6 });
    });

    it('kök-dışı geçiş yolu (..) reddedilir', () => {
        const parent = makeTempRoot('remap-measure-parent-');
        const root = join(parent, 'root');
        mkdirSync(root, { recursive: true });
        writeFileSync(join(parent, 'escape.txt'), 'nope\n', 'utf8');

        const { stats, outsideRoot } = measureProductionFileStats(root, ['../escape.txt']);

        expect(outsideRoot).toBe(1);
        expect(stats.size).toBe(0);
    });

    it('8 MiB üstünde satır sayılmaz (lines=null), bayt statSync’den korunur', () => {
        const root = makeTempRoot();
        const big = Buffer.alloc(8 * 1024 * 1024 + 5, 0x61);
        writeFileSync(join(root, 'big.ts'), big);

        const { stats, unreadable, outsideRoot } = measureProductionFileStats(root, ['big.ts']);

        expect(unreadable).toBe(0);
        expect(outsideRoot).toBe(0);
        expect(stats.get('big.ts')).toEqual({ path: 'big.ts', lines: null, bytes: big.length });
    });

    it('8 MiB sınırı dâhilinde satır sayımı yapılır', () => {
        const root = makeTempRoot();
        const exact = Buffer.concat([Buffer.alloc(8 * 1024 * 1024 - 2, 0x61), Buffer.from('\n\n')]);
        writeFileSync(join(root, 'exact.ts'), exact);

        const { stats } = measureProductionFileStats(root, ['exact.ts']);

        expect(stats.get('exact.ts')).toEqual({ path: 'exact.ts', lines: 2, bytes: 8 * 1024 * 1024 });
    });

    it('aynı girdi aynı sonucu verir; yinelenen yol tek kez ölçülür', () => {
        const root = makeTempRoot();
        writeFileSync(join(root, 'a.ts'), 'l1\nl2\n', 'utf8');

        const first = measureProductionFileStats(root, ['a.ts']);
        const second = measureProductionFileStats(root, ['a.ts', 'a.ts']);

        expect(JSON.stringify([...first.stats.entries()])).toBe(JSON.stringify([...second.stats.entries()]));
        expect(second.stats.size).toBe(1);
        expect(second.unreadable).toBe(0);
        expect(second.outsideRoot).toBe(0);
    });

    it('erişilemeyen kök arayan hatasıdır ve patlar', () => {
        expect(() => measureProductionFileStats(join(tmpdir(), 'remap-missing-root-xyz'), [])).toThrow();
    });
});
