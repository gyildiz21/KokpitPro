// Delta sonuç sözleşmesi — Dilim 3, schemaVersion 1.
//
// computeDelta çıktısının makine sözleşmesi (DESIGN D1): alan adları İngilizce
// sabittir; yerelleşmez. Her nesne `.strict()` ile kapatılır — tüketici
// bilinmeyen alanı sessizce yutmaz. Modül saftır: I/O yok, model çağrısı yok.

import { z } from 'zod';

/** Delta kipi: ölçüldü · yalnız bildirildi · ölçülemez. */
export const DeltaMode = z.enum(['measured', 'declared-only', 'unmeasurable']);
export type DeltaMode = z.infer<typeof DeltaMode>;

/** Kanıt türü hiyerarşisi: makbuz eşlemesi > salt metin > hiçbiri. */
export const EvidenceKind = z.enum(['receipt-mapping', 'declared-text-only', 'none']);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

/** Neden kodları — makine sözleşmesi; mesaj metni serbest, kod sabittir. */
export const DeltaReasonCode = z.enum([
    'item-not-found',
    'stale-receipt',
    'no-local-checkout',
    'paths-not-measured',
    'edges-not-measurable-yet',
    'comparison-baseline-unavailable',
    'no-mapping',
]);
export type DeltaReasonCode = z.infer<typeof DeltaReasonCode>;

export const DeltaReason = z
    .object({
        code: DeltaReasonCode,
        message: z.string().min(1),
    })
    .strict();
export type DeltaReason = z.infer<typeof DeltaReason>;

/** Bildirilen ama henüz ölçülmemiş yol için öneri düğümü; kenarı UYDURULMAZ. */
export const ProposedNode = z
    .object({
        id: z.string().min(1),
        label: z.string().min(1),
        path: z.string().min(1),
    })
    .strict();
export type ProposedNode = z.infer<typeof ProposedNode>;

/** Kimlik çiftiyle kenar referansı — yönlü from→to. */
export const EdgeRef = z
    .object({
        from: z.string().min(1),
        to: z.string().min(1),
    })
    .strict();
export type EdgeRef = z.infer<typeof EdgeRef>;

/** Karşılaştırmanın yapıldığı makbuz revizyonu — geri izlenebilirlik için. */
export const BaseRevision = z
    .object({
        kind: z.enum(['commit', 'working-tree']),
        revision: z.string().min(1),
        commit: z.string().min(1),
        branch: z.string().min(1),
    })
    .strict();
export type BaseRevision = z.infer<typeof BaseRevision>;

/**
 * Tek bir plan maddesinin dürüst deltası. DESIGN D5 · sürümlü şema kararı
 * (eski kod yorumundaki "D5.2" kısaltması; PLAN'daki Dilim 5.2 ürün dilimiyle
 * ilişkisi yoktur): şema sürümlüdür — uyumsuz üretici çıktısını tüketici
 * reddeder. Liste alanlarındaki `max` sınırları patlama nöbetçisidir; aşım
 * hesaplayıcı tarafından kırpmayla önlenir.
 */
export const DeltaResult = z
    .object({
        schemaVersion: z.literal(1),
        projectId: z.string().min(1),
        itemId: z.string().min(1),
        phaseHeading: z.string(),
        mode: DeltaMode,
        baseRevision: BaseRevision,
        declaredPaths: z.array(z.string()).max(64),
        affectedNodeIds: z.array(z.string()).max(64),
        affectedPaths: z.array(z.string()).max(64),
        affectedTests: z.array(z.string()).max(64),
        proposedNodes: z.array(ProposedNode).max(32),
        addedEdges: z.array(EdgeRef).max(128),
        removedEdges: z.array(EdgeRef).max(128),
        evidenceKind: EvidenceKind,
        reasons: z.array(DeltaReason).max(16),
        durationMs: z.number().nonnegative(),
    })
    .strict();
export type DeltaResult = z.infer<typeof DeltaResult>;
