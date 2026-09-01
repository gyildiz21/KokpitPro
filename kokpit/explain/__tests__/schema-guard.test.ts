// Şema nöbetçisi — Dilim 5.2 · ExplanationEnvelope v1 (DESIGN D8).
//
// Strict disiplin, origin/provenance değişmezi ve sınır değerleri burada
// sabitlenir: bilinmeyen alan reddedilir; deterministik zarfta provider
// yasaktır; AI zarfında provider/model zorunludur; confidence 0..1'dir.

import { describe, expect, it } from 'vitest';
import {
    AiExplanationProposal,
    ExplanationEnvelope,
    ExplanationEnvelopeObject,
    LocalizedText,
} from '../schema';

function validDeterministic(): Record<string, unknown> {
    return {
        schemaVersion: 1,
        projectId: 'demo-proje',
        sourceRevision: 'rev-1',
        subjectKind: 'violation',
        subjectId: 'v-1',
        origin: 'deterministic',
        summary: { tr: 'sade özet', en: 'plain summary' },
        whatItMeans: { tr: 'sade anlam', en: 'plain meaning' },
        whyItMatters: { tr: 'sade önem', en: 'plain importance' },
        recommendedActions: [{ id: 'reindex', label: { tr: 'Yeniden indeksle', en: 'Re-index' } }],
        verificationSteps: [{ tr: 'Koşumu yeniden çalıştır', en: 'Re-run compliance' }],
        evidenceRefs: [{ label: { tr: 'Dosya', en: 'File' }, value: 'src/a.ts:3' }],
        limitations: [],
        generatedAt: '2026-08-31T09:00:00.000Z',
    };
}

describe('ExplanationEnvelope v1 — strict şema disiplini', () => {
    it('geçerli deterministik zarf kabul edilir', () => {
        expect(ExplanationEnvelope.safeParse(validDeterministic()).success).toBe(true);
    });

    it('bilinmeyen üst düzey alan reddedilir (strict)', () => {
        const bad = { ...validDeterministic(), rule: 'hex-in-component' };
        const result = ExplanationEnvelope.safeParse(bad);
        expect(result.success).toBe(false);
    });

    it('bilinmeyen iç içe alan reddedilir (strict)', () => {
        const bad = validDeterministic() as Record<string, unknown>;
        bad.recommendedActions = [{ id: 'reindex', label: { tr: 'x', en: 'y' }, severity: 'error' }];
        expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
    });

    it('deterministik zarfta provider YASAKTIR', () => {
        const bad = { ...validDeterministic(), provider: 'hermetik-fixture' };
        expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
    });

    it('deterministik zarfta model YASAKTIR', () => {
        const bad = { ...validDeterministic(), model: 'hermetik-fixture-1' };
        expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
    });

    it('deterministik zarfta confidence YASAKTIR', () => {
        const bad = { ...validDeterministic(), confidence: 0.5 };
        expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
    });

    it('AI zarfında provider olmadan reddedilir', () => {
        const bad = { ...validDeterministic(), origin: 'ai', model: 'm-1' };
        expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
    });

    it('AI zarfında model olmadan reddedilir', () => {
        const bad = { ...validDeterministic(), origin: 'ai', provider: 'p-1' };
        expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
    });

    it('AI zarfı provider+model ile (confidence opsiyonel) kabul edilir', () => {
        const good = { ...validDeterministic(), origin: 'ai', provider: 'p-1', model: 'm-1' };
        expect(ExplanationEnvelope.safeParse(good).success).toBe(true);
        const withConfidence = { ...good, confidence: 0.5 };
        expect(ExplanationEnvelope.safeParse(withConfidence).success).toBe(true);
    });

    it('confidence 0..1 aralığındadır; sınır değerleri geçerlidir', () => {
        for (const confidence of [0, 1]) {
            const good = { ...validDeterministic(), origin: 'ai', provider: 'p', model: 'm', confidence };
            expect(ExplanationEnvelope.safeParse(good).success).toBe(true);
        }
        for (const confidence of [-0.01, 1.01]) {
            const bad = { ...validDeterministic(), origin: 'ai', provider: 'p', model: 'm', confidence };
            expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
        }
    });

    it('schemaVersion 1e sabittir', () => {
        const bad = { ...validDeterministic(), schemaVersion: 2 };
        expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
    });

    it('bilinmeyen subjectKind reddedilir', () => {
        const bad = { ...validDeterministic(), subjectKind: 'rumor' };
        expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
    });

    it('bilinmeyen eylem kimliği reddedilir — güvenli küme dışı eylem çizilmez', () => {
        const bad = validDeterministic() as Record<string, unknown>;
        bad.recommendedActions = [{ id: 'magic-auto-fix', label: { tr: 'Otomatik düzelt', en: 'Auto-fix' } }];
        expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
    });

    it('LocalizedText iki dili de boş olmayan metinle ister', () => {
        expect(LocalizedText.safeParse({ tr: 'merhaba', en: 'hello' }).success).toBe(true);
        expect(LocalizedText.safeParse({ tr: 'merhaba' }).success).toBe(false);
        expect(LocalizedText.safeParse({ tr: '', en: 'hello' }).success).toBe(false);
    });

    it('generatedAt ISO datetime ister', () => {
        const bad = { ...validDeterministic(), generatedAt: '2026-08-31 09:00:00' };
        expect(ExplanationEnvelope.safeParse(bad).success).toBe(false);
    });

    it('liste alanları patlama sınırına sahiptir (8/8/12/8)', () => {
        const action = { id: 'none' as const, label: { tr: 'x', en: 'y' } };
        const step = { tr: 'adım', en: 'step' };
        const ref = { label: { tr: 'k', en: 'v' }, value: '1' };

        const atLimits = {
            ...validDeterministic(),
            recommendedActions: Array.from({ length: 8 }, () => action),
            verificationSteps: Array.from({ length: 8 }, () => step),
            evidenceRefs: Array.from({ length: 12 }, () => ref),
            limitations: Array.from({ length: 8 }, () => step),
        };
        expect(ExplanationEnvelope.safeParse(atLimits).success).toBe(true);

        const overLimits = {
            ...atLimits,
            recommendedActions: Array.from({ length: 9 }, () => action),
        };
        expect(ExplanationEnvelope.safeParse(overLimits).success).toBe(false);

        expect(
            ExplanationEnvelope.safeParse({ ...atLimits, verificationSteps: Array.from({ length: 9 }, () => step) }).success,
        ).toBe(false);
        expect(
            ExplanationEnvelope.safeParse({ ...atLimits, evidenceRefs: Array.from({ length: 13 }, () => ref) }).success,
        ).toBe(false);
        expect(
            ExplanationEnvelope.safeParse({ ...atLimits, limitations: Array.from({ length: 9 }, () => step) }).success,
        ).toBe(false);
    });
});

describe('AiExplanationProposal — yapısal garanti', () => {
    it('boş proposal geçerlidir (tüm alanlar opsiyonel)', () => {
        expect(AiExplanationProposal.safeParse({}).success).toBe(true);
    });

    it('bilinmeyen alan reddedilir — sağlayıcı ölçülmüş gerçek taşıyamaz', () => {
        expect(AiExplanationProposal.safeParse({ severity: 'error' }).success).toBe(false);
        expect(AiExplanationProposal.safeParse({ addedEdges: [] }).success).toBe(false);
        expect(AiExplanationProposal.safeParse({ state: 'closed' }).success).toBe(false);
        expect(AiExplanationProposal.safeParse({ verificationSteps: [] }).success).toBe(false);
    });

    it('confidence 0..1 dışında reddedilir', () => {
        expect(AiExplanationProposal.safeParse({ confidence: 1.5 }).success).toBe(false);
        expect(AiExplanationProposal.safeParse({ confidence: 0.5 }).success).toBe(true);
    });
});

describe('ExplanationEnvelopeObject — iç nesne biçimi', () => {
    it('refine öncesi nesne şeması dışa açıktır ve stricttir', () => {
        expect(ExplanationEnvelopeObject.safeParse({ ...validDeterministic(), extra: true }).success).toBe(false);
    });
});
