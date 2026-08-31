// Dilim 5.2 · Korpus raporu: çelişki motorunun gerçek bir korpus üzerindeki
// dürüst ölçüm özeti. Motor kararlarıyla birlikte red nedenlerini sayar;
// ham aday ile elde tutulan aday ayrımı truncation gerekçeleriyle raporlanır.
// Modül saftır: I/O yok, ölçüm girdileri ConflictContext ile gelir ve
// aynı girdi her zaman aynı raporu üretir.

import type { ConflictEntry } from './schema';
import {
    CONFLICT_REJECTION_REASONS,
    evaluateConflicts,
    type ConflictContext,
    type ConflictRejectionReason,
} from './conflicts';

export interface ConflictCorpusReport {
    /** Tüm kapılardan geçen ham aday sayısı (id tekrarı ve 64 sınırı öncesi). */
    rawCandidateCount: number;
    /** Çıktı sözleşmesine göre elde tutulan adaylar (id tekrarı ayıklanmış, ≤64). */
    retainedCandidates: ConflictEntry[];
    /** Kapı bazlı red dağılımı; yedi nedenin tamamı her raporda mevcuttur. */
    rejectionCounts: Record<ConflictRejectionReason, number>;
    /** Ayıklama gerekçeleri: 'duplicate-candidate-id', 'candidate-cap-64'. */
    truncationReasons: string[];
    scannedScope: {
        planStatements: number;
        ledgerSections: number;
        ledgerDecisions: number;
        pairsEvaluated: number;
    };
}

/**
 * Gerçek korpus ölçümü: detectConflicts ile aynı motor koşusu üzerinden
 * red dağılımını ve kapsam sayaçlarını üretir. Deterministiktir; kişisel
 * veri taşımaz, yalnız motora giden metinlerden türeyen sayımlar ve konu
 * tokenları döner.
 */
export function analyzeConflictCorpus(ctx: ConflictContext): ConflictCorpusReport {
    const evaluation = evaluateConflicts(ctx);
    return {
        rawCandidateCount: evaluation.rawCandidateCount,
        retainedCandidates: evaluation.entries,
        rejectionCounts: { ...evaluation.rejectionCounts },
        truncationReasons: [...evaluation.truncationReasons],
        scannedScope: { ...evaluation.scannedScope },
    };
}

/** Red dağılımının tamamlanmışlık nöbetçisi: yedi neden eksiksiz sayılır. */
export function assertRejectionCoverage(report: ConflictCorpusReport): void {
    for (const reason of CONFLICT_REJECTION_REASONS) {
        if (typeof report.rejectionCounts[reason] !== 'number') {
            throw new Error(`rejectionCounts is missing '${reason}'; the report contract is broken.`);
        }
    }
}
