// Dilim 5.2 · Korpus raporu nöbetçileri: red dağılımı, kapsam sayaçları ve
// ham/elde-tutulan ayrımı. Örnekler sentetik ve anonimdir.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    analyzeConflictCorpus,
    assertRejectionCoverage,
    createConflictCorpusReceipt,
    sha256Text,
} from '../corpus-report';
import type { ConflictContext } from '../conflicts';

function ctxWith(planText: string, ledgerText: string): ConflictContext {
    return {
        planText,
        planPath: 'ROADMAP.md',
        ledgerText,
        ledgerPath: '.agents/karar-defteri.md',
        fallbackDate: '2026-08-27',
    };
}

describe('analyzeConflictCorpus — dürüst ölçüm (Dilim 5.2)', () => {
    it('red nedeni dağılımı ve kapsam sayaçları doğru sayılır', () => {
        const report = analyzeConflictCorpus(ctxWith(
            [
                '# Plan',
                '',
                '**Son Güncelleme:** 2026-08-04',
                '',
                '## Konu',
                '',
                'Hazır tez korpusu bağlayıcı değildir; 2026 backend adı açık form değildir.',
            ].join('\n'),
            [
                '# Karar Defteri',
                '',
                '### Genel bölüm',
                '',
                '**Durum:** ✅ KARAR (2026-08-25) → Backend adı 2026 açık form genişlet.',
                '',
                '### Ölçüm bölümü',
                '',
                '**Durum:** ✅ KARAR (2026-08-22) → Tez korpusunu ve bağlayıcıyı genişlet; ölçüm açılır.',
            ].join('\n'),
        ));
        expect(report.rejectionCounts).toEqual({
            'generic-token-only': 2,
            'no-restrictive-direction': 0,
            'no-expansive-direction': 0,
            'weak-topic-overlap': 1,
            'unrelated-flow': 2,
            'repeated-restriction': 0,
            'chronology-invalid': 0,
        });
        expect(report.scannedScope).toEqual({
            planStatements: 2,
            ledgerSections: 2,
            ledgerDecisions: 2,
            pairsEvaluated: 6,
        });
        expect(report.rawCandidateCount).toBe(1);
        expect(report.retainedCandidates).toHaveLength(1);
        expect(report.truncationReasons).toEqual([]);
        expect(Object.values(report.rejectionCounts).reduce((sum, count) => sum + count, 0))
            .toBe(report.scannedScope.pairsEvaluated - report.rawCandidateCount);
        assertRejectionCoverage(report);
    });

    it('ham > elde tutulan ayrımı: id tekrarı ayıklanır ve gerekçelenir', () => {
        const report = analyzeConflictCorpus(ctxWith(
            [
                '# Plan',
                '',
                '**Son Güncelleme:** 2026-08-04',
                '',
                '## Konu',
                '',
                'Ölçüm tez korpusu değildir.',
                'Ölçüm korpusu değildir.',
            ].join('\n'),
            [
                '# Karar Defteri',
                '',
                '### Ölçüm bölümü',
                '',
                '**Durum:** ✅ KARAR (2026-08-22) → Tez korpusunu ve ölçüm kapsamını genişlet.',
            ].join('\n'),
        ));
        expect(report.rawCandidateCount).toBe(2);
        expect(report.retainedCandidates).toHaveLength(1);
        expect(report.truncationReasons).toEqual(['duplicate-candidate-id']);
    });

    it('karar defteri yoksa boş kapsamla dürüst rapor döner', () => {
        const report = analyzeConflictCorpus({
            planText: 'Tez korpusu değildir.',
            planPath: 'ROADMAP.md',
            ledgerText: null,
            ledgerPath: '.agents/karar-defteri.md',
            fallbackDate: '2026-08-27',
        });
        expect(report.rawCandidateCount).toBe(0);
        expect(report.retainedCandidates).toEqual([]);
        expect(report.scannedScope).toEqual({
            planStatements: 0,
            ledgerSections: 0,
            ledgerDecisions: 0,
            pairsEvaluated: 0,
        });
        assertRejectionCoverage(report);
    });

    it('kaynak ve motor kökenini mutlak yol sızdırmadan hashli makbuza bağlar', () => {
        const report = analyzeConflictCorpus(ctxWith('Ölçüm tez korpusu değildir.', '### Karar\n\n**Durum:** ✅ KARAR (2026-08-22) → Ölçüm tez korpusunu genişlet.'));
        const base = {
            measuredAt: '2026-09-01T08:00:00.000Z',
            fallbackDate: '2026-09-01',
            planPath: 'ROADMAP.md',
            ledgerPath: '.agents/karar-defteri.md',
            planSha256: sha256Text('plan'),
            ledgerSha256: sha256Text('ledger'),
            engineSha256: sha256Text('engine'),
            source: { commit: 'a'.repeat(40), revisionKind: 'working-tree' as const, revision: `${'a'.repeat(40)}+working-tree:1234` },
            engine: { commit: 'b'.repeat(40), revisionKind: 'commit' as const, revision: 'b'.repeat(40) },
        };
        const first = createConflictCorpusReceipt(report, base);
        const repeatedLater = createConflictCorpusReceipt(report, { ...base, measuredAt: '2026-09-01T09:00:00.000Z' });

        expect(first.schemaVersion).toBe(1);
        expect(first.provenance.reportId).toBe(repeatedLater.provenance.reportId);
        expect(first.provenance.measuredAt).not.toBe(repeatedLater.provenance.measuredAt);
        expect(first.provenance.source.revisionKind).toBe('working-tree');
        expect(JSON.stringify(first)).not.toContain('C:\\Users');
        expect(first.provenance.planSha256).toHaveLength(64);
        expect(first.provenance.engineSha256).toHaveLength(64);
    });

    it('kalıcı gerçek-korpus makbuzu sürümlü, izlenebilir ve kişisel mutlak yolsuzdur', () => {
        const text = readFileSync(resolve('docs/analiz/dilim-5-2-methodlogos-corpus-receipt.json'), 'utf8');
        const receipt = JSON.parse(text) as {
            schemaVersion: number;
            provenance: {
                planPath: string;
                ledgerPath: string;
                planSha256: string;
                ledgerSha256: string;
                engineSha256: string;
                reportId: string;
                source: { commit: string; revisionKind: string };
            };
            rawCandidateCount: number;
            retainedCandidates: unknown[];
            rejectionCounts: Record<string, number>;
            scannedScope: { pairsEvaluated: number };
        };

        expect(receipt.schemaVersion).toBe(1);
        expect(receipt.provenance.planPath).toBe('ROADMAP.md');
        expect(receipt.provenance.ledgerPath).toBe('.agents/karar-defteri.md');
        expect(receipt.provenance.source.revisionKind).toBe('commit');
        expect(receipt.provenance.source.commit).toMatch(/^[0-9a-f]{40}$/);
        for (const hash of [receipt.provenance.planSha256, receipt.provenance.ledgerSha256, receipt.provenance.engineSha256, receipt.provenance.reportId]) {
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        }
        expect(text).not.toMatch(/[A-Z]:\\/i);
        expect(receipt.retainedCandidates).toHaveLength(receipt.rawCandidateCount);
        expect(Object.values(receipt.rejectionCounts).reduce((sum, count) => sum + count, 0) + receipt.rawCandidateCount)
            .toBe(receipt.scannedScope.pairsEvaluated);
    });
});
