// Dilim 5.2 · Korpus raporu nöbetçileri: red dağılımı, kapsam sayaçları ve
// ham/elde-tutulan ayrımı. Örnekler sentetik ve anonimdir.

import { describe, expect, it } from 'vitest';
import { analyzeConflictCorpus, assertRejectionCoverage } from '../corpus-report';
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
});
