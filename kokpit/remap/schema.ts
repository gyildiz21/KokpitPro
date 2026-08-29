// AJAN B entegrasyon kopyası — kanonik sürüm AJAN A dalındadır; birleştirmede
// AJAN A sürümü alınır.
//
// RemapReport v1 sözleşmesi — Dilim 4, schemaVersion 1.
//
// Remap önerisi makine sözleşmesidir (DESIGN D7): alan adları İngilizce
// sabittir; yerelleşmez. Her nesne `.strict()` ile kapatılır — tüketici
// bilinmeyen alanı sessizce yutmaz. Öneri repository gerçeği, ihlal veya
// otomatik değişiklik DEĞİL, ölçülmüş kanıttan türeyen insan-inceleme
// adayıdır; `proposed:true` bu durumu sözleşmeye taşır.

import { z } from 'zod';

/** Öneri başına ölçülmüş metrikler — yalnız kuralın kullandığı alanlar doludur. */
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

/**
 * Tek bir yeniden düzenleme önerisi: insan-inceleme adayı. Yalnız ölçülmüş
 * resolved import kenarlarından ve uygun üretim dosyalarından üretilir.
 */
export const RemapSuggestion = z
    .object({
        id: z.string().min(1),
        kind: z.enum(['large-file', 'shared-import', 'cross-layer-placement-review']),
        targetPath: z.string().min(1),
        /** Yalnız hedef gerçekten render seçimindeyse dolar; uydurulmaz. */
        nodeId: z.string().min(1).optional(),
        reasonCode: z.enum(['size-over-threshold', 'fan-in-over-threshold', 'placement-review-multi-group']),
        metrics: RemapMetrics,
        relatedPaths: z.array(z.string()).max(16).optional(),
        relatedGroups: z.array(z.string()).max(8).optional(),
        sourceRevision: z.string().min(1),
        proposed: z.literal(true),
    })
    .strict();
export type RemapSuggestion = z.infer<typeof RemapSuggestion>;

/** Ölçüm kapsamı — dürüstlük nöbetçisi: kapsam olmadan temiz SAYILMAZ. */
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

/** Ölçüm dürüstlük sürek kontrolü: motor ölçemediyse boş liste temiz SAYILMAZ. */
export const RemapReport = z
    .object({
        version: z.literal(1),
        projectId: z.string().min(1),
        sourceRevision: z.string().min(1),
        generatedAt: z.string().datetime(),
        measurement: z.enum(['measured', 'partial', 'unmeasurable']),
        reasons: z.array(z.object({ code: z.string().min(1), message: z.string().min(1) }).strict()).max(16),
        coverage: RemapCoverage,
        suggestions: z.array(RemapSuggestion).max(24),
        truncated: z.boolean(),
    })
    .strict();
export type RemapReport = z.infer<typeof RemapReport>;
