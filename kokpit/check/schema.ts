// Uyum telemetrisi sözleşmesi — Dilim 5, schemaVersion 1.
//
// ComplianceReport makine sözleşmesidir (DESIGN D1): alan adları İngilizce
// sabittir; yerelleşmez. Her nesne `.strict()` ile kapatılır — tüketici
// bilinmeyen alanı sessizce yutmaz. Kural kodları UI-SPEC §10.4'teki
// kanonik adlarla birebir aynıdır; bu dosya dondurulmuştur ve değişiklik
// Patron GO'suna tabidir. Tek birleşik sağlık yüzdesi şemada YOKTUR.

import { z } from 'zod';

/** Başlangıç kural seti — genişletme ayrı Patron kapısıdır (UI-SPEC §10.4). */
export const RuleCode = z.enum([
    'koşumsuz-commit',
    'hardcode-metin',
    'hex-in-component',
    'sahte-kapı',
    'bayat-kutu',
    'ks-band',
]);
export type RuleCode = z.infer<typeof RuleCode>;

/** Kural ciddiyeti (kural dili) — bağlam ciddiyetinden ayrıdır. */
export const ViolationSeverity = z.enum(['error', 'warning', 'note']);
export type ViolationSeverity = z.infer<typeof ViolationSeverity>;

/**
 * Bağlam ciddiyeti (CodeScene friction deseni): hedefin bölgesindeki
 * ölçülmüş değişim yoğunluğu. Sıralama friction×severity'dir; ikisi ayrı
 * alanlar olarak taşınır — tek sayıya katıştırılmaz.
 */
export const ContextFriction = z.enum(['low', 'elevated', 'high']);
export type ContextFriction = z.infer<typeof ContextFriction>;

/**
 * İhlal durumu triage dilidir (UI-SPEC §10.4). `closed` yalnız gerekçeli
 * kayıtla oluşur: kapatma yükümlülüğü API sözleşmesidir, istemci diline
 * bırakılmaz.
 */
export const ViolationState = z.enum(['open', 'closed']);
export type ViolationState = z.infer<typeof ViolationState>;

export const Violation = z
    .object({
        /** Deterministik kimlik: rule+target türevi; koşumlar arası sabittir. */
        id: z.string().min(1),
        rule: RuleCode,
        severity: ViolationSeverity,
        state: ViolationState,
        /** Hedef konum: repo-göreli yol; bilinmiyorsa belge tanımı geçer. */
        targetPath: z.string().min(1),
        targetLine: z.number().int().positive().optional(),
        message: z.string().min(1),
        /** Referans kural metni (ör. DESIGN.md D2#4). */
        ruleReference: z.string().min(1),
        contextFriction: ContextFriction,
        /** Friction hesabının girdisi: hedef bölgenin ölçülmüş değişim sayısı. */
        changeCount: z.number().int().nonnegative(),
        closedAt: z.string().datetime().optional(),
        closedBy: z.string().min(1).optional(),
        closureJustification: z.string().min(1).optional(),
    })
    .strict()
    .refine(
        (entry) =>
            entry.state === 'open' ||
            (typeof entry.closedAt === 'string' &&
                typeof entry.closedBy === 'string' &&
                typeof entry.closureJustification === 'string'),
        { message: 'closed violation requires closedAt, closedBy and closureJustification' },
    );
export type Violation = z.infer<typeof Violation>;

export const SyncStatus = z.enum(['current', 'stale', 'missing', 'partial']);
export type SyncStatus = z.infer<typeof SyncStatus>;

/** Near-miss kırılma nedenleri (Nx deseni) — tek satır gerekçe zorunlu. */
export const NearMissReasonCode = z.enum([
    'date-gap',
    'content-hash-mismatch',
    'version-field-missing',
    'phase-file-missing',
]);
export type NearMissReasonCode = z.infer<typeof NearMissReasonCode>;

export const SyncEntry = z
    .object({
        sliceId: z.string().min(1),
        phaseFile: z.string().nullable(),
        roadmapBox: SyncStatus,
        handoff: SyncStatus,
        nearMiss: z
            .object({
                reasonCode: NearMissReasonCode,
                message: z.string().min(1),
            })
            .strict()
            .optional(),
    })
    .strict();
export type SyncEntry = z.infer<typeof SyncEntry>;

export const ConflictStatus = z.enum(['open-conflict', 'superseded-chain', 'clean']);
export type ConflictStatus = z.infer<typeof ConflictStatus>;

export const ConflictEntry = z
    .object({
        id: z.string().min(1),
        topic: z.string().min(1),
        status: ConflictStatus,
        authorityA: z.string().min(1),
        authorityB: z.string().min(1),
        observedAtA: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        observedAtB: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        suggestion: z.string().min(1),
    })
    .strict();
export type ConflictEntry = z.infer<typeof ConflictEntry>;

/**
 * Dört bağımsız sağlık bandı (DORA formu): faz dağılımı, defter bayatlığı,
 * ihlal sayıları ve açık çelişki AYRI tutulur. Toplanıp tek yüzdeye
 * çevrilmeleri şema düzeyinde imkânsızdır.
 */
export const ComplianceHealth = z
    .object({
        phaseDone: z.number().int().nonnegative(),
        partial: z.number().int().nonnegative(),
        open: z.number().int().nonnegative(),
        syncStale: z.number().int().nonnegative(),
        vioErr: z.number().int().nonnegative(),
        vioWarn: z.number().int().nonnegative(),
        conflictOpen: z.number().int().nonnegative(),
    })
    .strict();
export type ComplianceHealth = z.infer<typeof ComplianceHealth>;

/** Ölçüm dürüstlük sürek kontrolü: motor ölçemediyse boş liste temiz SAYILMAZ. */
export const MeasurementMode = z.enum(['measured', 'unmeasured']);
export type MeasurementMode = z.infer<typeof MeasurementMode>;

export const ComplianceReport = z
    .object({
        version: z.literal(1),
        projectId: z.string().min(1),
        generatedAt: z.string().datetime(),
        measurement: MeasurementMode,
        reasons: z.array(z.object({ code: z.string(), message: z.string() }).strict()).max(16),
        violations: z.array(Violation).max(256),
        sync: z.array(SyncEntry).max(128),
        conflicts: z.array(ConflictEntry).max(64),
        health: ComplianceHealth,
    })
    .strict();
export type ComplianceReport = z.infer<typeof ComplianceReport>;

/** Kapatma isteği gövdesi — gerekçe boşsa API reddeder. */
export const ClosureRequest = z
    .object({
        violationId: z.string().min(1),
        justification: z.string().trim().min(1),
        by: z.string().trim().min(1),
    })
    .strict();
export type ClosureRequest = z.infer<typeof ClosureRequest>;
