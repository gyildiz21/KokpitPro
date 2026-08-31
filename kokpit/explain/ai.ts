// Opsiyonel AI açıklama altyapısı — Dilim 5.2 (DESIGN D8.4).
//
// AI yorumu opsiyoneldir ve sınırlıdır: repo bazında opt-in/GO olmadan
// çağrı yapılmaz; gerçek ücretli sağlayıcı AYRI Patron GO'sudur. Bu yüzden
// createExplainAiProvider yalnız KOKPIT_AI_EXPLAIN==='fixture' iken hermetik
// fixture sağlar; başka her değer fail-closed olarak null döner — arayüz
// hazırdır, kabul koşumu opt-in atlanır. Sağlayıcı ölçülen alanları
// değiştiremez: AiExplanationProposal tipi yapısal garantidir. Kaynak
// revizyonu değişirse AI yorumu bayattır ve servis edilmez; sağlayıcı
// hatalıysa deterministik açıklama korunur ve teknik hata mesajı kullanıcı
// kanıtı gibi taşınmaz.

import type { AiExplanationProposal, AiExplanationRequest, ExplanationEnvelope, LocalizedText } from './schema';

/** Sağlayıcı arayüzü — gerçek ücretli sağlayıcılar bu sözleşmeyi doldurur. */
export interface ExplainAiProvider {
    readonly id: string;
    readonly model: string;
    generate(request: AiExplanationRequest): Promise<AiExplanationProposal>;
}

/** Birleştirme üstverisi: provenance alanları zarfa aynen taşınır. */
export interface AiMergeMeta {
    provider: string;
    model: string;
    sourceRevision: string;
    generatedAt: string;
}

/**
 * Sınır (max 8) doluysa en eski limitation düşürülür; yeni dürüstlük notu
 * daima korunur — şema sınırı bunu zorunlu kılar.
 */
function appendLimitation(list: LocalizedText[], item: LocalizedText): LocalizedText[] {
    return list.length >= 8 ? [...list.slice(list.length - 7), item] : [...list, item];
}

function withLimitation(envelope: ExplanationEnvelope, item: LocalizedText): ExplanationEnvelope {
    return { ...envelope, limitations: appendLimitation(envelope.limitations, item) };
}

const FIXTURE_LIMITATION: LocalizedText = {
    tr: 'AI yorumu hermetik fixture’dan gelir.',
    en: 'AI commentary comes from the hermetic fixture.',
};

const STALE_AI_LIMITATION: LocalizedText = {
    tr: 'AI yorumu bayat: kaynak revizyonu değişti; eski AI yorumu servis edilmez.',
    en: 'AI commentary is stale: the source revision changed and old commentary is not served.',
};

const AI_PROPOSAL_LIMITATION: LocalizedText = {
    tr: 'AI yorumu öneridir; ölçülen hiçbir gerçek (kenar, ciddiyet, durum, kabul) değiştirilemez.',
    en: 'AI commentary is a proposal; it cannot change any measured fact (edge, severity, state, acceptance).',
};

const FALLBACK_LIMITATION: LocalizedText = {
    tr: 'AI yorumu şu anda alınamadı; deterministik açıklama gösteriliyor.',
    en: 'AI commentary is unavailable right now; the deterministic explanation is shown.',
};

/**
 * Hermetik fixture sağlayıcı: ağ çağrısı YOK; çıktı DETERMİNİSTİK —
 * measured zarfının metinlerini lafız olarak kopyalar ve limitations'a
 * fixture notunu ekler. confidence sabittir; fixture ölçmediği için tam
 * güven iddia etmez.
 */
class HermeticFixtureProvider implements ExplainAiProvider {
    readonly id = 'hermetik-fixture';
    readonly model: string;

    constructor(model: string) {
        this.model = model;
    }

    async generate(request: AiExplanationRequest): Promise<AiExplanationProposal> {
        const measured = request.measured;
        return {
            summary: { ...measured.summary },
            whatItMeans: { ...measured.whatItMeans },
            whyItMatters: { ...measured.whyItMatters },
            recommendedActions: measured.recommendedActions.map((action) => ({ id: action.id, label: { ...action.label } })),
            limitations: appendLimitation(
                measured.limitations.map((limit) => ({ ...limit })),
                { ...FIXTURE_LIMITATION },
            ),
            confidence: 0.5,
        };
    }
}

/**
 * Fail-closed fabrika: yalnız KOKPIT_AI_EXPLAIN==='fixture' iken hermetik
 * fixture döner (model adı KOKPIT_AI_EXPLAIN_MODEL, varsayılan
 * 'hermetik-fixture-1'). Başka her değer — KOKPIT_AI_EXPLAIN_PROVIDER ile
 * gerçek sağlayıcı talebi dahi — null üretir; gerçek ücretli sağlayıcı
 * ayrı Patron GO'sudur.
 */
export function createExplainAiProvider(env: NodeJS.ProcessEnv): ExplainAiProvider | null {
    if (env.KOKPIT_AI_EXPLAIN !== 'fixture') {
        return null;
    }
    return new HermeticFixtureProvider(env.KOKPIT_AI_EXPLAIN_MODEL || 'hermetik-fixture-1');
}

/**
 * AI önerisini deterministik zarfla birleştirir. meta.sourceRevision !==
 * deterministic.sourceRevision ise AI BAYATTIR: deterministik zarf, limitations'a
 * bayatlık notu eklenerek döner (origin deterministic kalır). Uyumsa origin:'ai'
 * zarfı: ölçülen alanlar (verificationSteps, evidenceRefs, subject kimlikleri)
 * deterministic'ten aynen; metin alanları proposal'dan; provenance meta'dan taşınır.
 */
export function mergeAiExplanation(
    deterministic: ExplanationEnvelope,
    proposal: AiExplanationProposal,
    meta: AiMergeMeta,
): ExplanationEnvelope {
    if (meta.sourceRevision !== deterministic.sourceRevision) {
        return withLimitation(deterministic, { ...STALE_AI_LIMITATION });
    }
    const merged: ExplanationEnvelope = {
        schemaVersion: deterministic.schemaVersion,
        projectId: deterministic.projectId,
        sourceRevision: deterministic.sourceRevision,
        subjectKind: deterministic.subjectKind,
        subjectId: deterministic.subjectId,
        origin: 'ai',
        summary: proposal.summary ?? deterministic.summary,
        whatItMeans: proposal.whatItMeans ?? deterministic.whatItMeans,
        whyItMatters: proposal.whyItMatters ?? deterministic.whyItMatters,
        recommendedActions: proposal.recommendedActions ?? deterministic.recommendedActions,
        verificationSteps: deterministic.verificationSteps,
        evidenceRefs: deterministic.evidenceRefs,
        limitations: appendLimitation(
            (proposal.limitations ?? deterministic.limitations).map((limit) => ({ ...limit })),
            { ...AI_PROPOSAL_LIMITATION },
        ),
        generatedAt: meta.generatedAt,
        provider: meta.provider,
        model: meta.model,
    };
    if (proposal.confidence !== undefined) {
        merged.confidence = proposal.confidence;
    }
    return merged;
}

/**
 * Sağlayıcı hatasından dürüst dönüş: deterministik zarf korunur; limitations'a
 * alınamama notu eklenir. Hata mesajı bilinçli olarak HİÇBİR alana
 * TAŞINMAZ — teknik hata kullanıcı kanıtı gibi sunulmaz (DESIGN D8.4).
 */
export function explainAiFallback(_error: unknown, deterministic: ExplanationEnvelope): ExplanationEnvelope {
    return withLimitation(deterministic, { ...FALLBACK_LIMITATION });
}
