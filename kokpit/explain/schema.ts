// Açıklama katmanı sözleşmesi — Dilim 5.2, schemaVersion 1 (DESIGN D8).
//
// ExplanationEnvelope, ölçüm sözleşmelerini (ComplianceReport v1, DiagramGraph
// v1, Delta) tüketen AYRI ve sürümlü bir projection'dır (UI-SPEC §10.9.2):
// açıklama katmanı hiçbir ölçülmüş kaydı ekleyemez, çıkaramaz, ciddiyetini
// veya durumunu değiştiremez. Her nesne `.strict()` ile kapatılır — tüketici
// bilinmeyen alanı sessizce yutmaz. Makine alan adları İngilizce sabittir;
// kullanıcıya görünen metinler TR/EN çift kanallıdır (DESIGN D1).
// provider/model/confidence yalnız origin:'ai' iken bulunabilir; deterministik
// zarfta yasaktır. Bu dosya dondurulmuştur; değişiklik Patron GO'suna tabidir.

import { z } from 'zod';

/** Kullanıcıya görünen çift kanallı metin — her iki dil zorunlu ve boş olamaz. */
export const LocalizedText = z
    .object({
        tr: z.string().min(1),
        en: z.string().min(1),
    })
    .strict();
export type LocalizedText = z.infer<typeof LocalizedText>;

/** Açıklamanın konu ailesi — ölçüm sözleşmelerindeki kayıt türleriyle eşleşir. */
export const ExplanationSubjectKind = z.enum([
    'violation',
    'sync',
    'conflict',
    'delta-item',
    'plan-slice',
    'coverage',
]);
export type ExplanationSubjectKind = z.infer<typeof ExplanationSubjectKind>;

/**
 * Güvenli eylem kimlikleri: katalog yalnız bu kümeden eylem önerebilir; UI
 * küme dışındaki eylemi çizmez (sahte kapı yok). Etiket katalogda TR/EN taşınır.
 */
export const ExplanationActionId = z.enum([
    'reindex',
    'link-local-checkout',
    'map-plan-path',
    'open-record',
    'select-item',
    'rebuild-index',
    'verify-token-registry',
    'run-compliance',
    'human-review',
    'none',
]);
export type ExplanationActionId = z.infer<typeof ExplanationActionId>;

export const ExplanationAction = z
    .object({
        id: ExplanationActionId,
        label: LocalizedText,
    })
    .strict();
export type ExplanationAction = z.infer<typeof ExplanationAction>;

/** Teknik kanıt referansı: etiket kullanıcı dilinde, değer ham teknik veridir. */
export const ExplanationEvidenceRef = z
    .object({
        label: LocalizedText,
        value: z.string(),
    })
    .strict();
export type ExplanationEvidenceRef = z.infer<typeof ExplanationEvidenceRef>;

export const ExplanationOrigin = z.enum(['deterministic', 'ai']);
export type ExplanationOrigin = z.infer<typeof ExplanationOrigin>;

/**
 * ExplanationEnvelope v1 — DESIGN D8 alan listesiyle birebir eş. Bu nesne
 * dondurulmuştur; alan eklemek/çıkarmak Patron GO'suna tabidir. Liste
 * alanlarındaki `max` sınırları patlama nöbetçisidir.
 */
export const ExplanationEnvelopeObject = z
    .object({
        schemaVersion: z.literal(1),
        projectId: z.string().min(1),
        sourceRevision: z.string().min(1),
        subjectKind: ExplanationSubjectKind,
        subjectId: z.string().min(1),
        origin: ExplanationOrigin,
        summary: LocalizedText,
        whatItMeans: LocalizedText,
        whyItMatters: LocalizedText,
        recommendedActions: z.array(ExplanationAction).max(8),
        verificationSteps: z.array(LocalizedText).max(8),
        evidenceRefs: z.array(ExplanationEvidenceRef).max(12),
        limitations: z.array(LocalizedText).max(8),
        generatedAt: z.string().datetime(),
        provider: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
        confidence: z.number().min(0).max(1).optional(),
    })
    .strict();

/** Süslü sözleşme: provenance değişmezini zorlayan refine'lı nihai şema. */
export const ExplanationEnvelope = ExplanationEnvelopeObject.refine(
    (envelope) =>
        envelope.origin === 'deterministic'
            ? envelope.provider === undefined &&
              envelope.model === undefined &&
              envelope.confidence === undefined
            : envelope.provider !== undefined && envelope.model !== undefined,
    {
        message:
            'provider/model/confidence yalnız origin:"ai" iken bulunabilir; deterministik zarfta yasaktır ve origin:"ai" için provider+model zorunludur',
    },
);
export type ExplanationEnvelope = z.infer<typeof ExplanationEnvelope>;

/**
 * AI sağlayıcısının döndürebildiği TEK alanlar. Ölçülmüş gerçek (kenar,
 * ciddiyet, durum, kabul) bu tipte YOKTUR — sağlayıcı yapısal olarak
 * ölçülen hiçbir gerçeği değiştiremez (DESIGN D8.4); metin alanları
 * eksik bırakılırsa deterministik zarftaki karşılığı korunur.
 */
export const AiExplanationProposal = z
    .object({
        summary: LocalizedText.optional(),
        whatItMeans: LocalizedText.optional(),
        whyItMatters: LocalizedText.optional(),
        recommendedActions: z.array(ExplanationAction).max(8).optional(),
        limitations: z.array(LocalizedText).max(8).optional(),
        confidence: z.number().min(0).max(1).optional(),
    })
    .strict();
export type AiExplanationProposal = z.infer<typeof AiExplanationProposal>;

/** Sağlayıcıya giden istek: deterministik zarf GİRDİ olarak verilir. */
export const AiExplanationRequest = z
    .object({
        projectId: z.string().min(1),
        sourceRevision: z.string().min(1),
        subjectKind: ExplanationSubjectKind,
        subjectId: z.string().min(1),
        measured: ExplanationEnvelope,
    })
    .strict();
export type AiExplanationRequest = z.infer<typeof AiExplanationRequest>;
