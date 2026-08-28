import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyClosures, ComplianceClosureStore, type ClosureRecord } from '../closures';
import { ComplianceReport } from '../schema';

const tempRoots: string[] = [];

function closure(sourceRevision = 'rev-1'): ClosureRecord {
    return {
        projectId: 'local-x',
        sourceRevision,
        violationId: 'hex-in-component:src-a-css:1:fingerprint1',
        closedAt: '2026-08-27T12:00:00.000Z',
        closedBy: 'patron',
        justification: 'Token kayıt dosyasına taşındı.',
        rule: 'hex-in-component',
        targetPath: 'src/a.css',
        severity: 'error',
    };
}

function report(sourceRevision = 'rev-1') {
    return ComplianceReport.parse({
        version: 1,
        projectId: 'local-x',
        sourceRevision,
        generatedAt: '2026-08-27T12:00:00.000Z',
        measurement: 'measured',
        reasons: [],
        violations: [{
            id: 'hex-in-component:src-a-css:1:fingerprint1',
            rule: 'hex-in-component',
            severity: 'error',
            state: 'open',
            targetPath: 'src/a.css',
            targetLine: 1,
            message: 'Hex literal.',
            ruleReference: 'AGENTS.md',
            contextFriction: 'unmeasured',
            changeCount: 0,
        }],
        sync: [],
        conflicts: [],
        health: { phaseDone: 0, partial: 0, open: 0, syncStale: 0, vioErr: 1, vioWarn: 0, conflictOpen: 0 },
        coverage: { eligibleFiles: 1, scannedFiles: 1, skippedLargeFiles: 0, unreadableFiles: 0, skippedSymlinks: 0, outsideRootPaths: 0, truncated: false },
    });
}

afterEach(() => {
    for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('ComplianceClosureStore — revizyon bağlı audit', () => {
    it('aynı revizyonda mükerrer kapanışı reddeder; yeni revizyonu ayrı kayıt sayar', () => {
        const root = mkdtempSync(join(tmpdir(), 'kokpit-closure-'));
        tempRoots.push(root);
        const store = new ComplianceClosureStore(root);
        store.add(closure());
        expect(() => store.add(closure())).toThrow(/already closed/);
        store.add(closure('rev-2'));
        expect(store.list('local-x')).toHaveLength(2);
        expect(JSON.parse(readFileSync(store.filePath, 'utf8')).closures).toHaveLength(2);
    });

    it('yalnız aynı kaynak revizyonu ve ihlal kimliği eşleşince kapatır', () => {
        expect(applyClosures(report('rev-1'), [closure('rev-1')]).violations[0]?.state).toBe('closed');
        const newer = applyClosures(report('rev-2'), [closure('rev-1')]);
        expect(newer.violations[0]?.state).toBe('open');
        expect(newer.health.vioErr).toBe(1);
    });

    it('proje silme temizliği audit kayıtlarını da kaldırır', () => {
        const root = mkdtempSync(join(tmpdir(), 'kokpit-closure-'));
        tempRoots.push(root);
        const store = new ComplianceClosureStore(root);
        store.add(closure());
        store.remove('local-x');
        expect(store.list('local-x')).toEqual([]);
    });
});
