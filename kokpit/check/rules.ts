// Dilim 5 · Kural ihlali dedektörleri (UI-SPEC §10.4).
//
// Modül saftır: girdi ctx ile verilir, I/O yok. Her kural deterministiktir;
// sıralama friction×severity'dir ve eşitlikte id lexicographic'tir — koşumlar
// arası kararlılık nöbetçi testlerle korunur. Bağlam ciddiyeti v1'de
// ölçülmediği için dürüstçe 'unmeasured' + changeCount:0 taşır; sahte yoğunluk
// uydurulmaz.

import { createHash } from 'node:crypto';
import type { PhaseGroup, PhaseItem } from '../parser/schema';
import type { ContextFriction, RuleCode, Violation, ViolationSeverity } from './schema';

/** Repo-göreli üretim dosyası dilimi (içerik zaten okunmuş). */
export interface LocalFileSlice {
    path: string;
    content: string;
}

export interface RuleContext {
    /** Makbuzdaki plan yolu (repo-göreli) — hedef adresi budur. */
    planPath: string;
    groups: PhaseGroup[];
    files: LocalFileSlice[];
    /** Determinizm çapası: index.indexedAt (koşum saatine bağlılık yasak). */
    receiptDate: string;
}

const FRICTION_RANK: Record<ContextFriction, number> = { unmeasured: 0, low: 1, elevated: 2, high: 3 };
const SEVERITY_RANK: Record<ViolationSeverity, number> = { error: 3, warning: 2, note: 1 };

export function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9çğıöşü]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function daysBetween(fromIso: string, untilIso: string): number {
    const from = Date.parse(fromIso);
    const until = Date.parse(untilIso);
    if (Number.isNaN(from) || Number.isNaN(until)) return 0;
    return Math.floor((until - from) / 86_400_000);
}

interface ViolationSeed {
    rule: RuleCode;
    severity: ViolationSeverity;
    targetPath: string;
    targetLine?: number;
    message: string;
    ruleReference: string;
}

function seedToViolation(seed: ViolationSeed): Violation {
    const identity = `${seed.rule}\0${seed.targetPath}\0${seed.targetLine ?? 0}`;
    const fingerprint = createHash('sha256').update(identity).digest('hex').slice(0, 12);
    return {
        id: `${seed.rule}:${slugify(seed.targetPath).slice(0, 48)}:${seed.targetLine ?? 0}:${fingerprint}`,
        rule: seed.rule,
        severity: seed.severity,
        state: 'open',
        targetPath: seed.targetPath,
        ...(seed.targetLine !== undefined ? { targetLine: seed.targetLine } : {}),
        message: seed.message,
        ruleReference: seed.ruleReference,
        contextFriction: 'unmeasured',
        changeCount: 0,
    };
}

/** Aynı hedefe birden fazla kural vurursa çakışmasın; deterministik birleşim. */
function mergeSeeds(seeds: ViolationSeed[]): Violation[] {
    const merged = new Map<string, Violation>();
    for (const seed of seeds) {
        const violation = seedToViolation(seed);
        const existing = merged.get(violation.id);
        if (!existing || SEVERITY_RANK[violation.severity] > SEVERITY_RANK[existing.severity]) merged.set(violation.id, violation);
    }
    return [...merged.values()];
}

const HEX_LINE_RE = /(?:^|[^\w&])#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
/** CSS custom-property tanımı = belirteç kayıt yeri; hex yalnız burada legaldir. */
const CUSTOM_PROPERTY_DEF_RE = /^\s*--st-[\w-]+\s*:/;
const TURKISH_TEXT_RE = /(?:^|>)[^<>{}"'`]*[çğıöşüÇĞİÖŞÜ]/;
const TEST_FILE_RE = /(?:^|\/)(?:__tests__|[^/]+\.test\.|[^/]+\.spec\.)/;
const TEST_GATE_RE = /\.(?:only|skip)\(|\bxit\(|\bxdescribe\(/;
const FAKE_SUCCESS_RE = /TODO-FAKE|fake-success|stub-ok/;

function hexInComponentSeeds(files: LocalFileSlice[]): ViolationSeed[] {
    const seeds: ViolationSeed[] = [];
    for (const file of files) {
        const lines = file.content.split(/\r?\n/);
        let perFile = 0;
        for (let index = 0; index < lines.length && perFile < 3; index += 1) {
            const line = lines[index] ?? '';
            if (CUSTOM_PROPERTY_DEF_RE.test(line)) continue;
            if (!HEX_LINE_RE.test(line)) continue;
            perFile += 1;
            seeds.push({
                rule: 'hex-in-component',
                severity: 'error',
                targetPath: file.path,
                targetLine: index + 1,
                message: 'Hex color literal found outside the token registry; use --st-* design tokens only.',
                ruleReference: 'AGENTS/DESIGN: bileşende hex yasak; yalnız --st-* belirteçleri',
            });
        }
    }
    return seeds;
}

function hardcodeTextSeeds(files: LocalFileSlice[]): ViolationSeed[] {
    const seeds: ViolationSeed[] = [];
    for (const file of files) {
        if (!/\.tsx$/.test(file.path) || !/(?:^|\/)ui\//.test(file.path)) continue;
        const lines = file.content.split(/\r?\n/);
        const line = lines.findIndex((candidate) => TURKISH_TEXT_RE.test(candidate) && !candidate.includes('${'));
        if (line < 0) continue;
        seeds.push({
            rule: 'hardcode-metin',
            severity: 'warning',
            targetPath: file.path,
            targetLine: line + 1,
            message: 'Possible hardcoded user-visible text in a UI component; route it through the i18n dictionary.',
            ruleReference: 'DESIGN D1: kullanıcıya görünen metin bileşende hardcode edilmez',
        });
    }
    return seeds;
}

function fakeGateSeeds(files: LocalFileSlice[]): ViolationSeed[] {
    const seeds: ViolationSeed[] = [];
    for (const file of files) {
        const lines = file.content.split(/\r?\n/);
        const isTestFile = TEST_FILE_RE.test(file.path);
        if (isTestFile) {
            const gated = lines.findIndex((line) => TEST_GATE_RE.test(line));
            if (gated >= 0) {
                seeds.push({
                    rule: 'sahte-kapı',
                    severity: 'warning',
                    targetPath: file.path,
                    targetLine: gated + 1,
                    message: 'Committed test gate (.skip/.only) found; record the reason or remove the gate.',
                    ruleReference: 'Nöbetçi disiplin: test gevşeterek kapatma yasak',
                });
            }
        }
        const fakeLine = lines.findIndex((line) => FAKE_SUCCESS_RE.test(line));
        if (fakeLine >= 0) {
            seeds.push({
                rule: 'sahte-kapı',
                severity: 'error',
                targetPath: file.path,
                targetLine: fakeLine + 1,
                message: 'Fake-success marker found; stub success must not be committed.',
                ruleReference: 'AGENTS: sahte/stub başarı yasak',
            });
        }
    }
    return seeds;
}

function planItemSeeds(ctx: RuleContext): ViolationSeed[] {
    const seeds: ViolationSeed[] = [];
    const receiptDay = ctx.receiptDate.slice(0, 10);
    const visit = (items: PhaseItem[]) => {
        let previousCompletion: string | null = null;
        for (const item of items) {
            if (item.status === 'done' && !item.completedAt) {
                seeds.push({
                    rule: 'koşumsuz-commit',
                    severity: 'warning',
                    targetPath: ctx.planPath,
                    targetLine: item.line,
                    message: `Plan item ${item.id} is marked done without a completion date; unconditional acceptance cannot be verified.`,
                    ruleReference: 'Kural: [x] kutusu kapanış tarihsiz bırakılamaz (Tamamlandı/kapandı YYYY-MM-DD)',
                });
            }
            if (item.status === 'done' && item.completedAt && daysBetween(`${item.completedAt}T00:00:00Z`, `${receiptDay}T00:00:00Z`) > 30) {
                seeds.push({
                    rule: 'bayat-kutu',
                    severity: 'note',
                    targetPath: ctx.planPath,
                    targetLine: item.line,
                    message: `Plan item ${item.id} was completed on ${item.completedAt}; the box has not been re-verified for over 30 days.`,
                    ruleReference: 'UI-SPEC §3.3: bayat veri (>7g) ayrı sinyal; kutu bayatlığı izlenir',
                });
            }
            if (item.completedAt && previousCompletion && item.completedAt < previousCompletion) {
                seeds.push({
                    rule: 'ks-band-delinmesi',
                    severity: 'warning',
                    targetPath: ctx.planPath,
                    targetLine: item.line,
                    message: `Completion dates run backwards in this phase: ${previousCompletion} precedes ${item.completedAt}.`,
                    ruleReference: 'Sağlık bandı tutarlılığı: tarih kronolojisi ters akamaz',
                });
            }
            if (item.completedAt) previousCompletion = item.completedAt;
        }
    };
    for (const group of ctx.groups) visit(group.items);
    return seeds;
}

export function detectRuleViolations(ctx: RuleContext): Violation[] {
    const violations = mergeSeeds([
        ...planItemSeeds(ctx),
        ...hexInComponentSeeds(ctx.files),
        ...hardcodeTextSeeds(ctx.files),
        ...fakeGateSeeds(ctx.files),
    ]);
    return sortViolations(violations);
}

export function sortViolations(violations: Violation[]): Violation[] {
    return [...violations].sort((a, b) => {
        const scoreA = FRICTION_RANK[a.contextFriction] * 10 + SEVERITY_RANK[a.severity];
        const scoreB = FRICTION_RANK[b.contextFriction] * 10 + SEVERITY_RANK[b.severity];
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
