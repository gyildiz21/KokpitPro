// Dilim 5 · Defter senkronu (UI-SPEC §10.3).
//
// Her kod dilimi için üçlü kontrol: faz dosyası güncellendi mi, ROADMAP kutusu
// işaretlendi mi, handoff/devir notu düştü mü. Near-miss zorunludur: ❌
// durumunda NEDEN kırıldığı tek satırda taşınır (tarih farkı / içerik
// tutarsızlığı / sürüm alanı / faz dosyası yok). v1 sınırlılığı dürüstçe
// yazılıdır: faz dosyası adı/içeriği yalnız eşleşen dilime bağlanır; Git
// commit başlıkları ve dosya değişim zamanı ek kanıttır, eşleşmeyen sinyal
// başka dilime yeniden kullanılmaz.

import type { PhaseGroup } from '../parser/schema';
import { scanPhaseFileText } from '../parser/phaseFiles';
import type { NearMissReasonCode, SyncEntry, SyncStatus } from './schema';

export interface SyncNamedFile {
    name: string;
    content: string;
    /** Dosyanın çalışma ağacındaki zamanı; Git kanıtı yoksa geri-düşüş. */
    modifiedAt?: string;
    /** `git log -1 -- <path>` ile ölçülmüş son değişiklik zamanı. */
    lastChangedAt?: string;
}

export interface SyncCommit {
    subject: string;
    committedAt: string;
}

export interface SyncFileSet {
    /** .agents/phases/*.md; dizin yoksa null (bilgi eksikliği sinyale dönüşür). */
    phaseFiles: SyncNamedFile[] | null;
    /** .agents/handoff*.md + next-session*.md; dizin/dosya yoksa null. */
    handoffFiles: SyncNamedFile[] | null;
    /** null = git kanıtı okunamadı; [] = okundu fakat eşleşen commit yok. */
    sliceCommits?: SyncCommit[] | null;
}

const DATE_GAP_DAYS = 7;

function normalizeEvidence(value: string): string {
    return value
        .toLocaleLowerCase('tr-TR')
        .replace(/[^a-z0-9çğıöşü.]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function groupEvidenceKeys(heading: string): string[] {
    const normalized = normalizeEvidence(heading);
    const keys = new Set<string>([normalized]);
    const dilim = /^dilim-([a-z0-9.]+)/.exec(normalized)?.[1];
    if (dilim) {
        keys.add(`dilim-${dilim}`);
        keys.add(`phase-${dilim}`);
    }
    const phase = /^(?:p|faz-|phase-)(\d+(?:\.\d+)?)/.exec(normalized)?.[1];
    if (phase) {
        keys.add(`p${phase}`);
        keys.add(`faz-${phase}`);
        keys.add(`phase-${phase}`);
    }
    return [...keys].filter((key) => key.length >= 2);
}

function containsEvidenceKey(haystack: string, key: string): boolean {
    if (key.length > 10 && haystack.includes(key)) return true;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|-)${escaped}(?:-|$)`).test(haystack);
}

function fileMatchesGroup(file: SyncNamedFile, group: PhaseGroup): boolean {
    const keys = groupEvidenceKeys(group.heading);
    const name = normalizeEvidence(file.name.replace(/\.md$/i, ''));
    if (keys.some((key) => containsEvidenceKey(name, key))) return true;
    const body = normalizeEvidence(file.content);
    const fullHeading = normalizeEvidence(group.heading);
    return fullHeading.length > 10 && body.includes(fullHeading);
}

function textMentionsGroup(text: string, group: PhaseGroup): boolean {
    const normalized = normalizeEvidence(text);
    return groupEvidenceKeys(group.heading).some((key) => containsEvidenceKey(normalized, key));
}

function latestCompletion(group: PhaseGroup): string | null {
    const dates = group.items
        .map((item) => item.completedAt)
        .filter((value): value is string => typeof value === 'string')
        .sort();
    return dates.at(-1) ?? null;
}

function phaseFileStatus(group: PhaseGroup, phaseFiles: SyncNamedFile[] | null): { status: SyncStatus; nearMissCode?: NearMissReasonCode; nearMissMessage?: string } {
    if (!phaseFiles) {
        return {
            status: 'missing',
            nearMissCode: 'phase-file-missing',
            nearMissMessage: 'No .agents/phases files found; the slice ledger signal cannot be verified.',
        };
    }
    const relevantFiles = phaseFiles.filter((file) => fileMatchesGroup(file, group));
    if (!relevantFiles.length) {
        return {
            status: 'missing',
            nearMissCode: 'phase-file-missing',
            nearMissMessage: `No phase file could be matched to ${group.heading}; unrelated phase signals were not reused.`,
        };
    }
    const signals = relevantFiles.flatMap((file) => scanPhaseFileText(file.content, file.name).signals);
    const datedSignals = signals.filter((signal): signal is typeof signal & { date: string } => typeof signal.date === 'string');
    const latestSignalDate = datedSignals.map((signal) => signal.date).sort().at(-1) ?? null;
    const latestFileDate = relevantFiles
        .map((file) => file.lastChangedAt ?? file.modifiedAt)
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.slice(0, 10))
        .sort()
        .at(-1) ?? null;
    const latestEvidenceDate = [latestSignalDate, latestFileDate]
        .filter((value): value is string => typeof value === 'string')
        .sort()
        .at(-1) ?? null;
    const completion = latestCompletion(group);
    const implementedSignals = signals.filter((signal) => signal.token === 'UYGULANDI' || signal.token === 'KAPANDI');
    const fullyDone = group.items.length > 0 && group.items.every((item) => item.status === 'done');
    if (implementedSignals.length && !fullyDone) {
        return {
            status: 'stale',
            nearMissCode: 'content-hash-mismatch',
            nearMissMessage: 'A phase file reports UYGULANDI/KAPANDI while the roadmap box still has open items.',
        };
    }
    if (completion && latestEvidenceDate && latestEvidenceDate < completion && days(latestEvidenceDate, completion) > DATE_GAP_DAYS) {
        return {
            status: 'stale',
            nearMissCode: 'date-gap',
            nearMissMessage: `Latest matched phase-file evidence (${latestEvidenceDate}) predates the roadmap completion date (${completion}) by more than ${DATE_GAP_DAYS} days.`,
        };
    }
    if (!fullyDone) return { status: 'partial' };
    if (!datedSignals.length) {
        return {
            status: 'missing',
            nearMissCode: 'version-field-missing',
            nearMissMessage: 'Phase files carry no dated status signals; the slice closure cannot be cross-checked.',
        };
    }
    return { status: 'current' };
}

function days(from: string, until: string): number {
    const fromMs = Date.parse(`${from}T00:00:00Z`);
    const untilMs = Date.parse(`${until}T00:00:00Z`);
    if (Number.isNaN(fromMs) || Number.isNaN(untilMs)) return 0;
    return Math.round((untilMs - fromMs) / 86_400_000);
}

function handoffStatus(group: PhaseGroup, handoffFiles: SyncNamedFile[] | null): SyncStatus {
    if (!handoffFiles) return 'missing';
    const mentioned = handoffFiles.some((file) => fileMatchesGroup(file, group) || textMentionsGroup(file.content, group));
    return mentioned ? 'current' : 'partial';
}

function roadmapBoxStatus(group: PhaseGroup, commits: SyncCommit[] | null | undefined): { status: SyncStatus; nearMissCode?: NearMissReasonCode; nearMissMessage?: string } {
    const fullyDone = group.items.length > 0 && group.items.every((item) => item.status === 'done');
    if (fullyDone) {
        if (Array.isArray(commits) && !commits.some((commit) => textMentionsGroup(commit.subject, group))) {
            return {
                status: 'partial',
                nearMissCode: 'slice-commit-missing',
                nearMissMessage: `Roadmap boxes are complete, but no matching slice commit was found for ${group.heading}.`,
            };
        }
        return { status: 'current' };
    }
    const anyProgress = group.items.some((item) => item.status === 'done' || item.status === 'partial');
    return { status: anyProgress ? 'partial' : 'missing' };
}

export function deriveSyncEntries(groups: PhaseGroup[], files: SyncFileSet): SyncEntry[] {
    const entries: SyncEntry[] = [];
    for (const group of groups) {
        const box = roadmapBoxStatus(group, files.sliceCommits);
        const phase = phaseFileStatus(group, files.phaseFiles);
        const handoff = handoffStatus(group, files.handoffFiles);
        const nearMissCode = phase.nearMissCode ?? box.nearMissCode;
        const nearMissMessage = phase.nearMissMessage ?? box.nearMissMessage;
        const nearMiss = nearMissCode && nearMissMessage ? { reasonCode: nearMissCode, message: nearMissMessage } : undefined;
        entries.push({
            sliceId: group.heading,
            phaseFile: phase.status,
            roadmapBox: box.status,
            handoff,
            ...(nearMiss ? { nearMiss } : {}),
        });
    }
    return entries;
}

export function countSyncStale(entries: SyncEntry[]): number {
    return entries.filter(
        (entry) => entry.roadmapBox !== 'current' || entry.phaseFile !== 'current' || entry.handoff !== 'current',
    ).length;
}
