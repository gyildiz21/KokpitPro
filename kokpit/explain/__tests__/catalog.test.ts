// Katalog kapsamı nöbetçisi — Dilim 5.2 (PLAN 5.2.2).
//
// Kataloğun kapsaması söz verilen HER kod için tam zarf üretilir: dört soru
// (ne oldu · neden önemli · ilk güvenli eylem · doğrulama) doludur, TR/EN
// alanları boş değildir. Bilinmeyen kod çökmez; jenerik dürüst zarf verir —
// bu sahte değil, dürüst sınırdır.

import { describe, expect, it } from 'vitest';
import { explainConflictStatus, explainReasonCode, explainRuleCode, explainSyncReasonCode, type ExplainContext } from '../catalog';
import { ExplanationEnvelope, type ExplanationEnvelope as ExplanationEnvelopeT } from '../schema';

const RULE_CODES = ['hex-in-component', 'koşumsuz-commit', 'hardcode-metin', 'sahte-kapı', 'bayat-kutu', 'ks-band-delinmesi'];

const SYNC_CODES = ['date-gap', 'content-hash-mismatch', 'version-field-missing', 'phase-file-missing', 'slice-commit-missing'];

const DELTA_REASON_CODES = [
    'no-mapping',
    'stale-receipt',
    'no-local-checkout',
    'paths-not-measured',
    'edges-not-measurable-yet',
    'comparison-baseline-unavailable',
    'item-not-found',
];

const COVERAGE_REASON_CODES = [
    'git-history-unavailable',
    'git-history-truncated',
    'scan-truncated',
    'report-records-truncated',
    'large-files-skipped',
    'unreadable-files',
    'symlinks-skipped',
    'outside-root-rejected',
    'root-unreadable',
];

const CONFLICT_STATUSES = ['candidate', 'superseded-chain', 'open-conflict', 'clean'];

const CTX: ExplainContext = { projectId: 'demo-proje', sourceRevision: 'rev-1', subjectId: 's-1' };

function expectCompleteEnvelope(envelope: ExplanationEnvelopeT): void {
    expect(() => ExplanationEnvelope.parse(envelope)).not.toThrow();
    for (const text of [envelope.summary, envelope.whatItMeans, envelope.whyItMatters]) {
        expect(text.tr.length).toBeGreaterThan(0);
        expect(text.en.length).toBeGreaterThan(0);
    }
    expect(envelope.recommendedActions.length).toBeGreaterThanOrEqual(1);
    for (const action of envelope.recommendedActions) {
        expect(action.label.tr.length).toBeGreaterThan(0);
        expect(action.label.en.length).toBeGreaterThan(0);
    }
    expect(envelope.verificationSteps.length).toBeGreaterThanOrEqual(1);
    expect(envelope.origin).toBe('deterministic');
}

describe('deterministik katalog — kural kodları', () => {
    it.each(RULE_CODES)('%s tam zarf üretir', (code) => {
        const envelope = explainRuleCode(code, CTX);
        expectCompleteEnvelope(envelope);
        expect(envelope.subjectKind).toBe('violation');
        expect(envelope.subjectId).toBe('s-1');
    });
});

describe('deterministik katalog — senkron near-miss kodları', () => {
    it.each(SYNC_CODES)('%s tam zarf üretir', (code) => {
        const envelope = explainSyncReasonCode(code, CTX);
        expectCompleteEnvelope(envelope);
        expect(envelope.subjectKind).toBe('sync');
    });
});

describe('deterministik katalog — delta neden kodları', () => {
    it.each(DELTA_REASON_CODES)('%s tam zarf üretir', (code) => {
        const envelope = explainReasonCode(code, CTX);
        expectCompleteEnvelope(envelope);
        expect(envelope.subjectKind).toBe('delta-item');
    });
});

describe('deterministik katalog — kapsam/kırpma neden kodları', () => {
    it.each(COVERAGE_REASON_CODES)('%s tam zarf üretir', (code) => {
        const envelope = explainReasonCode(code, CTX);
        expectCompleteEnvelope(envelope);
        expect(envelope.subjectKind).toBe('coverage');
    });
});

describe('deterministik katalog — çelişki durumları', () => {
    it.each(CONFLICT_STATUSES)('%s tam zarf üretir', (status) => {
        const envelope = explainConflictStatus(status, CTX);
        expectCompleteEnvelope(envelope);
        expect(envelope.subjectKind).toBe('conflict');
    });

    it('candidate insan onayı sınırını limitations taşır', () => {
        const envelope = explainConflictStatus('candidate', CTX);
        expect(envelope.limitations.some((limit) => limit.tr.includes('insan-inceleme adayıdır'))).toBe(true);
        expect(envelope.limitations.some((limit) => limit.tr.includes('onaylanmadan açık çelişki sayılmaz'))).toBe(true);
        expect(envelope.recommendedActions.some((action) => action.id === 'human-review')).toBe(true);
    });
});

describe('deterministik katalog — bilinmeyen kod dürüst sınırı', () => {
    it('bilinmeyen kural kodu çökmez; jenerik dürüst zarf verir', () => {
        const envelope = explainRuleCode('hic-gorulmemis-kural', CTX);
        expectCompleteEnvelope(envelope);
        expect(envelope.limitations.some((limit) => limit.tr.includes('kataloğa eklenmedi'))).toBe(true);
        expect(envelope.limitations.some((limit) => limit.en.includes('not been added'))).toBe(true);
    });

    it('bilinmeyen senkron kodu çökmez', () => {
        const envelope = explainSyncReasonCode('tanimsiz-near-miss', CTX);
        expectCompleteEnvelope(envelope);
        expect(envelope.limitations.some((limit) => limit.tr.includes('kataloğa eklenmedi'))).toBe(true);
    });

    it('bilinmeyen delta/kapsam kodu çökmez', () => {
        const envelope = explainReasonCode('tanimsiz-neden', CTX);
        expectCompleteEnvelope(envelope);
        expect(envelope.limitations.some((limit) => limit.tr.includes('kataloğa eklenmedi'))).toBe(true);
    });

    it('bilinmeyen çelişki durumu çökmez', () => {
        const envelope = explainConflictStatus('tanimsiz-durum', CTX);
        expectCompleteEnvelope(envelope);
        expect(envelope.limitations.some((limit) => limit.tr.includes('kataloğa eklenmedi'))).toBe(true);
    });

    it('bağlam kanıtları ve kimlik zarfa aynen taşınır', () => {
        const refs = [{ label: { tr: 'Dosya', en: 'File' }, value: 'src/a.ts:1' }];
        const envelope = explainRuleCode('hex-in-component', { ...CTX, evidenceRefs: refs });
        expect(envelope.evidenceRefs).toEqual(refs);
        expect(envelope.projectId).toBe('demo-proje');
        expect(envelope.sourceRevision).toBe('rev-1');
    });
});
