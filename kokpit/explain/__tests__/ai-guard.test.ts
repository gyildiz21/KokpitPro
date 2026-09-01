// AI guard nöbetçisi — Dilim 5.2 (DESIGN D8.4).
//
// Fail-closed fabrika, bayat revizyon reddi, sağlayıcı hata fallback'i ve
// hermetik fixture determinizmi burada sabitlenir. Gerçek ücretli sağlayıcı
// ayrı Patron GO'sudur; bu test dosyası ağ çağrısı YAPMAZ.

import { describe, expect, it } from 'vitest';
import {
    createExplainAiProvider,
    explainAiFallback,
    mergeAiExplanation,
    type AiMergeMeta,
    type ExplainAiProvider,
} from '../ai';
import { explainRuleCode } from '../catalog';
import { AiExplanationRequest, ExplanationEnvelope } from '../schema';

function deterministicEnvelope(sourceRevision = 'rev-1') {
    return explainRuleCode('hex-in-component', {
        projectId: 'demo-proje',
        sourceRevision,
        subjectId: 'v-1',
    });
}

function requestFor(envelope: ExplanationEnvelope): AiExplanationRequest {
    return AiExplanationRequest.parse({
        projectId: envelope.projectId,
        sourceRevision: envelope.sourceRevision,
        subjectKind: envelope.subjectKind,
        subjectId: envelope.subjectId,
        measured: envelope,
    });
}

const META: AiMergeMeta = { provider: 'hermetik-fixture', model: 'hermetik-fixture-1', sourceRevision: 'rev-1', generatedAt: '2026-08-31T10:00:00.000Z' };

describe('createExplainAiProvider — fail-closed dallar', () => {
    it('boş env ile sağlayıcı ÜRETİLMEZ', () => {
        expect(createExplainAiProvider({})).toBeNull();
    });

    it('bilinmeyen KOKPIT_AI_EXPLAIN değeri sağlayıcı ÜRETMEZ', () => {
        expect(createExplainAiProvider({ KOKPIT_AI_EXPLAIN: 'off' })).toBeNull();
        expect(createExplainAiProvider({ KOKPIT_AI_EXPLAIN: 'Fixture' })).toBeNull();
    });

    it('gerçek sağlayıcı talebi null döner — ücretli çağrı ayrı Patron GO\'sudur', () => {
        expect(
            createExplainAiProvider({ KOKPIT_AI_EXPLAIN: 'openai', KOKPIT_AI_EXPLAIN_PROVIDER: 'gpt' }),
        ).toBeNull();
    });

    it('fixture talebi hermetik sağlayıcı üretir; varsayılan model adı sabittir', () => {
        const provider = createExplainAiProvider({ KOKPIT_AI_EXPLAIN: 'fixture' });
        expect(provider).not.toBeNull();
        expect(provider?.id).toBe('hermetik-fixture');
        expect(provider?.model).toBe('hermetik-fixture-1');
    });

    it('KOKPIT_AI_EXPLAIN_MODEL model adını belirler', () => {
        const provider = createExplainAiProvider({ KOKPIT_AI_EXPLAIN: 'fixture', KOKPIT_AI_EXPLAIN_MODEL: 'deneme-9' });
        expect(provider?.model).toBe('deneme-9');
    });
});

describe('hermetik fixture provider', () => {
    it('çıktı deterministiktir: iki çağrı aynı proposal verir', async () => {
        const provider = createExplainAiProvider({ KOKPIT_AI_EXPLAIN: 'fixture' });
        const envelope = deterministicEnvelope();
        const request = requestFor(envelope);
        const first = await provider!.generate(request);
        const second = await provider!.generate(request);
        expect(first).toEqual(second);
    });

    it('measured zarfının metinlerini lafız olarak kopyalar; fixture notunu ekler', async () => {
        const provider = createExplainAiProvider({ KOKPIT_AI_EXPLAIN: 'fixture' });
        const envelope = deterministicEnvelope();
        const proposal = await provider!.generate(requestFor(envelope));
        expect(proposal.summary).toEqual(envelope.summary);
        expect(proposal.whatItMeans).toEqual(envelope.whatItMeans);
        expect(proposal.whyItMatters).toEqual(envelope.whyItMatters);
        expect(proposal.recommendedActions).toEqual(envelope.recommendedActions);
        expect(proposal.limitations?.some((limit) => limit.tr.includes('hermetik fixture'))).toBe(true);
        expect(proposal.confidence).toBe(0.5);
    });

    it('proposal yapısısal olarak yalnız izinli alanları taşır', async () => {
        const provider = createExplainAiProvider({ KOKPIT_AI_EXPLAIN: 'fixture' });
        const proposal = await provider!.generate(requestFor(deterministicEnvelope()));
        const allowed = new Set(['summary', 'whatItMeans', 'whyItMatters', 'recommendedActions', 'limitations', 'confidence']);
        for (const key of Object.keys(proposal)) {
            expect(allowed.has(key)).toBe(true);
        }
    });
});

describe('mergeAiExplanation — bayatlık ve provenance', () => {
    it('stale revizyon reddedilir: origin deterministic kalır ve bayatlık notu düşer', () => {
        const deterministic = deterministicEnvelope('rev-2');
        const proposal = { summary: { tr: 'yeni özet', en: 'new summary' } };
        const merged = mergeAiExplanation(deterministic, proposal, { ...META, sourceRevision: 'rev-1' });
        expect(merged.origin).toBe('deterministic');
        expect(merged.summary).toEqual(deterministic.summary);
        expect(merged.limitations.some((limit) => limit.tr.includes('bayat'))).toBe(true);
        expect(merged.provider).toBeUndefined();
        expect(() => ExplanationEnvelope.parse(merged)).not.toThrow();
    });

    it('stale durumda generatedAt deterministik zarftan korunur', () => {
        const deterministic = deterministicEnvelope('rev-2');
        const merged = mergeAiExplanation(deterministic, {}, { ...META, sourceRevision: 'rev-1' });
        expect(merged.generatedAt).toBe(deterministic.generatedAt);
    });

    it('taze revizyonda origin ai zarfı taşır: metin proposaldan, ölçülen alanlar deterministicten', () => {
        const deterministic = deterministicEnvelope();
        const proposal = {
            summary: { tr: 'AI sade özet', en: 'AI plain summary' },
            confidence: 0.7,
        };
        const merged = mergeAiExplanation(deterministic, proposal, META);
        expect(merged.origin).toBe('ai');
        expect(merged.summary).toEqual(proposal.summary);
        expect(merged.whatItMeans).toEqual(deterministic.whatItMeans);
        expect(merged.verificationSteps).toEqual(deterministic.verificationSteps);
        expect(merged.evidenceRefs).toEqual(deterministic.evidenceRefs);
        expect(merged.recommendedActions).toEqual(deterministic.recommendedActions);
        expect(merged.provider).toBe('hermetik-fixture');
        expect(merged.model).toBe('hermetik-fixture-1');
        expect(merged.confidence).toBe(0.7);
        expect(merged.generatedAt).toBe(META.generatedAt);
        expect(merged.limitations.some((limit) => limit.tr.includes('öneridir'))).toBe(true);
        expect(() => ExplanationEnvelope.parse(merged)).not.toThrow();
    });

    it('kısmi proposal alanları deterministicten doldurulur', () => {
        const deterministic = deterministicEnvelope();
        const merged = mergeAiExplanation(deterministic, {}, META);
        expect(merged.summary).toEqual(deterministic.summary);
        expect(merged.origin).toBe('ai');
    });

    it('limitations sınırı (8) korunur — taşkın notu zarfı geçersiz kılmaz', () => {
        const deterministic = deterministicEnvelope();
        const eightLimits = Array.from({ length: 8 }, (_, index) => ({ tr: `AI sınırı ${index}`, en: `AI limit ${index}` }));
        const proposal = { limitations: eightLimits };
        const merged = mergeAiExplanation(deterministic, proposal, META);
        expect(merged.limitations.length).toBe(8);
        expect(merged.limitations.at(-1)?.tr).toContain('öneridir');
        expect(() => ExplanationEnvelope.parse(merged)).not.toThrow();
    });

    it('proposal limitations vermezse deterministik limitations korunur ve nota yükseltilir', () => {
        const deterministic = deterministicEnvelope();
        const merged = mergeAiExplanation(deterministic, {}, META);
        expect(merged.limitations.slice(0, -1)).toEqual(deterministic.limitations);
        expect(merged.limitations.at(-1)?.tr).toContain('öneridir');
    });
});

describe('explainAiFallback — dürüst hata dönüşü', () => {
    it('deterministik zarfı korur; alınamama notu ekler; hata mesajını taşımaz', async () => {
        const deterministic = deterministicEnvelope();
        const failing: ExplainAiProvider = {
            id: 'broken',
            model: 'm',
            generate: async () => {
                throw new Error('SECRET-API-ENDPOINT http://internal.example');
            },
        };
        let caught: unknown;
        try {
            await failing.generate(requestFor(deterministic));
        } catch (error) {
            caught = error;
        }
        const fallback = explainAiFallback(caught, deterministic);
        expect(fallback.origin).toBe('deterministic');
        expect(fallback.summary).toEqual(deterministic.summary);
        expect(fallback.limitations.some((limit) => limit.tr.includes('AI yorumu şu anda alınamadı'))).toBe(true);
        const serialized = JSON.stringify(fallback);
        expect(serialized).not.toContain('SECRET-API-ENDPOINT');
        expect(serialized).not.toContain('internal.example');
        expect(() => ExplanationEnvelope.parse(fallback)).not.toThrow();
    });

    it('limitations sınırı doluysa notla birlikte 8de kalır', () => {
        const deterministic = deterministicEnvelope();
        const full: ExplanationEnvelope = {
            ...deterministic,
            limitations: Array.from({ length: 8 }, (_, index) => ({ tr: `sınır ${index}`, en: `limit ${index}` })),
        };
        const fallback = explainAiFallback(new Error('x'), full);
        expect(fallback.limitations.length).toBe(8);
        expect(fallback.limitations.at(-1)?.tr).toContain('alınamadı');
    });
});
