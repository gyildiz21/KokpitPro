// Parser çıktı sözleşmeleri — Dilim 1, schemaVersion 1.
//
// RoadmapScan ve PhaseFileScan parser'ların kanonik çıktılarıdır. Gelecekteki
// Kokpit-IR bunları tüketir; bu ara sözleşme değişirse tüketicilerin gürültülü
// biçimde kırılması kasıtlıdır.

import { z } from 'zod';

/** ROADMAP checkbox durumu: `[x]` done · `[ ]` open · `[~]` partial. */
export const ItemStatus = z.enum(['done', 'open', 'partial']);
export type ItemStatus = z.infer<typeof ItemStatus>;

/** Tek bir ROADMAP maddesi (checkbox satırı + devam satırlarından çıkarılanlar). */
export const PhaseItem = z.object({
    /** Açık kimlik (`#1`, `KB-4`) varsa o; yoksa faz içinde sıra numarasından `madde-N`. */
    id: z.string().min(1),
    /** Başlık: bold sarmalayıcı ve sondaki iki nokta temizlenmiş düz metin. */
    title: z.string().min(1),
    status: ItemStatus,
    /** Maddelerin ait olduğu en yakın `###` (yoksa `##`) başlığının tam metni. */
    phaseHeading: z.string(),
    /** Gövdede "Tamamlandı YYYY-MM-DD" / "kapandı YYYY-MM-DD" bulunduysa. */
    completedAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    /** Kaynak dosyadaki 1-tabanlı satır numarası — geri izlenebilirlik için. */
    line: z.number().int().positive(),
});
export type PhaseItem = z.infer<typeof PhaseItem>;

/** Bir başlık altındaki bütün maddeler. */
export const PhaseGroup = z.object({
    heading: z.string(),
    items: z.array(PhaseItem),
    /** Başlık kapsamındaki açık insan/sağlayıcı onay kapısı. */
    gateStatus: z.enum(['waiting-go']).optional(),
    gateLine: z.number().int().positive().optional(),
});
export type PhaseGroup = z.infer<typeof PhaseGroup>;

/** scanRoadmapText çıktısı. */
export const RoadmapScan = z.object({
    /** D5.2: şema sürümü — tüketici (harita/delta) uyumsuz veriyi reddeder. */
    schemaVersion: z.literal(1),
    sourceFile: z.string(),
    groups: z.array(PhaseGroup),
});
export type RoadmapScan = z.infer<typeof RoadmapScan>;

/**
 * Faz dosyası (.agents/phases/*.md) başlıklarından çıkan durum sinyali.
 * Öncelik sırası: DOCS_LOCK > WAITING_HUMAN > UYGULANDI > KAPANDI > KAPALI >
 * LOCKED > ACIK > DUZELTME > GO > RUNTIME.
 */
export const StatusToken = z.enum([
    'DOCS_LOCK',
    'WAITING_HUMAN',
    'UYGULANDI',
    'KAPANDI',
    'KAPALI',
    'LOCKED',
    'ACIK',
    'DUZELTME',
    'GO',
    'RUNTIME',
]);
export type StatusToken = z.infer<typeof StatusToken>;

export const FileSignal = z.object({
    file: z.string(),
    heading: z.string(),
    token: StatusToken,
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    line: z.number().int().positive(),
});
export type FileSignal = z.infer<typeof FileSignal>;

export const PhaseFileScan = z.object({
    schemaVersion: z.literal(1),
    sourceFile: z.string(),
    signals: z.array(FileSignal),
});
export type PhaseFileScan = z.infer<typeof PhaseFileScan>;
