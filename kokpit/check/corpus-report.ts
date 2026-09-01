// Dilim 5.2 · Korpus raporu: çelişki motorunun gerçek bir korpus üzerindeki
// dürüst ölçüm özeti. Motor kararlarıyla birlikte red nedenlerini sayar;
// ham aday ile elde tutulan aday ayrımı truncation gerekçeleriyle raporlanır.
// Modül saftır: I/O yok, ölçüm girdileri ConflictContext ile gelir ve
// aynı girdi her zaman aynı raporu üretir.

import { createHash } from 'node:crypto';
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

export type CorpusRevisionKind = 'commit' | 'working-tree' | 'unversioned';

export interface CorpusRevisionReceipt {
    commit: string | null;
    revisionKind: CorpusRevisionKind;
    /** Commit veya içerik parmak iziyle genişletilmiş çalışma-ağacı kimliği. */
    revision: string;
}

export interface ConflictCorpusProvenance {
    measuredAt: string;
    fallbackDate: string;
    /** Kişisel mutlak kök yazılmaz; yalnız korpus köküne göre yollar tutulur. */
    planPath: string;
    ledgerPath: string;
    planSha256: string;
    ledgerSha256: string | null;
    /** Ölçüm motorunun ilgili kaynak dosyalarının birlikte SHA-256 kimliği. */
    engineSha256: string;
    source: CorpusRevisionReceipt;
    engine: CorpusRevisionReceipt;
    /** Zaman damgası hariç aynı girdi+motor+çıktıda sabit kalan makbuz kimliği. */
    reportId: string;
}

export interface ConflictCorpusReceipt extends ConflictCorpusReport {
    schemaVersion: 1;
    provenance: ConflictCorpusProvenance;
}

export interface ConflictCorpusProvenanceInput extends Omit<ConflictCorpusProvenance, 'reportId'> {}

export function sha256Text(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Ölçüm raporunu kaynak/motor revizyonu ve içerik hashleriyle bağlar. reportId,
 * measuredAt'i kasıtlı olarak dışarıda bırakır: aynı kanıt başka zamanda tekrar
 * ölçüldüğünde kimlik kararlı, koşum zamanı ise dürüstçe ayrı kalır.
 */
export function createConflictCorpusReceipt(
    report: ConflictCorpusReport,
    provenance: ConflictCorpusProvenanceInput,
): ConflictCorpusReceipt {
    const reportId = sha256Text(JSON.stringify({
        schemaVersion: 1,
        fallbackDate: provenance.fallbackDate,
        planPath: provenance.planPath,
        ledgerPath: provenance.ledgerPath,
        planSha256: provenance.planSha256,
        ledgerSha256: provenance.ledgerSha256,
        engineSha256: provenance.engineSha256,
        source: provenance.source,
        engine: provenance.engine,
        report,
    }));
    return {
        schemaVersion: 1,
        provenance: { ...provenance, reportId },
        ...report,
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
