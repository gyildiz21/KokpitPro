// Kokpit-IR v0 — Dilim 1 sözleşmesi.
//
// Bu şema kokpitin tek veri sözleşmesidir: parser'lar bunu ÜRETİR, harita ve
// delta katmanları (Dilim 2–3) bunu TÜKETİR. Şema değişirse her iki taraf da
// kırılır — bu kasıtlıdır; sessiz sürüşme yerine gürültülü kırılma isteriz.

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
});
export type PhaseGroup = z.infer<typeof PhaseGroup>;

/** scanRoadmapText çıktısı. */
export const RoadmapScan = z.object({
    sourceFile: z.string(),
    groups: z.array(PhaseGroup),
});
export type RoadmapScan = z.infer<typeof RoadmapScan>;

/**
 * Faz dosyası (.agents/phases/*.md) başlıklarından çıkan durum sinyali.
 * Öncelik sırası: DOCS_LOCK > WAITING_HUMAN > UYGULANDI > KAPANDI > KAPALI >
 * LOCKED > ACIK > DUZELTME > GO > RUNTIME > PLAN.
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
    'PLAN',
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
    sourceFile: z.string(),
    signals: z.array(FileSignal),
});
export type PhaseFileScan = z.infer<typeof PhaseFileScan>;
