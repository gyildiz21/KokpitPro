// RemapReport sözleşmesi — Dilim 4, sürüm 1.
//
// Remap önerisi ölçülmüş kanıttan türetilen insan-inceleme adayıdır
// (DESIGN D7); repository gerçeği, ihlal veya otomatik değişiklik değildir.
// Alan adları İngilizce sabittir; yerelleşmez. Her nesne `.strict()` ile
// kapatılır — tüketici bilinmeyen alanı sessizce yutmaz. Öneride hedef
// klasör alanı YOKTUR: otomatik taşıma hedefi uydurulamaz. Modül saftır:
// I/O yok, model çağrısı yok.

import { z } from 'zod';
import { REMAP_THRESHOLDS } from './thresholds';

/** Öneri türü — üç ölçümlü kural; genişletme ayrı Patron kapısıdır. */
export const RemapSuggestionKind = z.enum([
    'large-file',
    'shared-import',
    'cross-layer-placement-review',
]);
export type RemapSuggestionKind = z.infer<typeof RemapSuggestionKind>;

/** Neden kodu — türle birebir eşleşir; eşleşme aşağıda şemaca zorlanır. */
export const RemapReasonCode = z.enum([
    'size-over-threshold',
    'fan-in-over-threshold',
    'placement-review-multi-group',
]);
export type RemapReasonCode = z.infer<typeof RemapReasonCode>;

/** Sabit tür→neden eşlemesi; şema ve motor aynı kaynaktan okur. */
export const REMAP_REASON_BY_KIND: Readonly<
    Record<z.infer<typeof RemapSuggestionKind>, z.infer<typeof RemapReasonCode>>
> = {
    'large-file': 'size-over-threshold',
    'shared-import': 'fan-in-over-threshold',
    'cross-layer-placement-review': 'placement-review-multi-group',
};

/** Ölçülmüş metrikler — hepsi opsiyonel, negatif-olmayan tam sayı. */
export const RemapMetrics = z
    .object({
        lines: z.number().int().nonnegative().optional(),
        bytes: z.number().int().nonnegative().optional(),
        importerFiles: z.number().int().nonnegative().optional(),
        importerGroupCount: z.number().int().nonnegative().optional(),
        foreignGroupCount: z.number().int().nonnegative().optional(),
    })
    .strict();
export type RemapMetrics = z.infer<typeof RemapMetrics>;

export const RemapSuggestion = z
    .object({
        /** Kararlı kimlik: `remap:<kind>:<targetPath>`; koşumlar arası sabittir. */
        id: z.string().min(1),
        kind: RemapSuggestionKind,
        targetPath: z.string().min(1),
        /**
         * Yalnız targetPath render edilen düğüm yollarındaysa bulunur;
         * aksi hâlde alan HİÇ bulunmaz (null/undefined ile bile olsa değil).
         */
        nodeId: z.string().min(1).optional(),
        reasonCode: RemapReasonCode,
        metrics: RemapMetrics,
        /** Sıralı (artan) importer yolları — en fazla 16. */
        relatedPaths: z.array(z.string()).max(16).optional(),
        /** Sıralı mimari grup kimlikleri — en fazla 8. */
        relatedGroups: z.array(z.string()).max(8).optional(),
        /** Önerinin türetildiği kaynak revizyon — geri izlenebilirlik. */
        sourceRevision: z.string().min(1),
        /** Bu bir inceleme adayıdır; repository gerçeği değil (DESIGN D7). */
        proposed: z.literal(true),
    })
    .strict()
    .refine(
        (suggestion) =>
            (suggestion.relatedPaths?.length ?? 0) > 0 || (suggestion.relatedGroups?.length ?? 0) > 0,
        { message: 'suggestion requires non-empty relatedPaths or relatedGroups' },
    )
    .refine((suggestion) => REMAP_REASON_BY_KIND[suggestion.kind] === suggestion.reasonCode, {
        message: 'reasonCode must match the fixed kind mapping',
    });
export type RemapSuggestion = z.infer<typeof RemapSuggestion>;

/** Ölçüm kapsamı — dürüst sayılar; kırpma ayrıca `truncated` ile bildirilir. */
export const RemapCoverage = z
    .object({
        eligibleFiles: z.number().int().nonnegative(),
        scannedFiles: z.number().int().nonnegative(),
        testOrFixtureFiles: z.number().int().nonnegative(),
        unresolvedImports: z.number().int().nonnegative(),
        renderedNodeCount: z.number().int().nonnegative(),
        truncated: z.boolean(),
    })
    .strict();
export type RemapCoverage = z.infer<typeof RemapCoverage>;

/**
 * Tek bir remap ölçüm koşusunun makine sözleşmesi. Liste sınırı
 * `REMAP_THRESHOLDS.maxSuggestions` ile aynıdır; aşması motor için
 * imkânsızdır (kırpma nöbetçisi).
 */
export const RemapReport = z
    .object({
        version: z.literal(1),
        projectId: z.string().min(1),
        sourceRevision: z.string().min(1),
        generatedAt: z.string().datetime(),
        measurement: z.enum(['measured', 'partial', 'unmeasurable']),
        reasons: z.array(z.object({ code: z.string().min(1), message: z.string().min(1) }).strict()).max(16),
        coverage: RemapCoverage,
        suggestions: z.array(RemapSuggestion).max(REMAP_THRESHOLDS.maxSuggestions),
        truncated: z.boolean(),
    })
    .strict();
export type RemapReport = z.infer<typeof RemapReport>;
