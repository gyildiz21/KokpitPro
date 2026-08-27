// Dilim 5 · Defter senkronu (UI-SPEC §10.3).
//
// Her kod dilimi için üçlü kontrol: faz dosyası güncellendi mi, ROADMAP kutusu
// işaretlendi mi, handoff/devir notu düştü mü. Near-miss zorunludur: ❌
// durumunda NEDEN kırıldığı tek satırda taşınır (tarih farkı / içerik
// tutarsızlığı / sürüm alanı / faz dosyası yok). v1 sınırlılığı dürüstçe
// yazılıdır: git commit tarihi dilim bazında ayrıştırılmadığından tarih
// denetimi faz-sinyali ↔ kutu-tarihi çaprazıdır; sahte kesinlik üretilmez.

import type { PhaseGroup } from '../parser/schema';
import { scanPhaseFileText } from '../parser/phaseFiles';
import type { NearMissReasonCode, SyncEntry, SyncStatus } from './schema';

export interface SyncNamedFile {
    name: string;
    content: string;
}

export interface SyncFileSet {
    /** .agents/phases/*.md; dizin yoksa null (bilgi eksikliği sinyale dönüşür). */
    phaseFiles: SyncNamedFile[] | null;
    /** .agents/handoff*.md + next-session*.md; dizin/dosya yoksa null. */
    handoffFiles: SyncNamedFile[] | null;
}

const DATE_GAP_DAYS = 7;

function sliceIdToken(heading: string): string | null {
    const match = /^(dilim\s+[a-z0-9.]+)/i.exec(heading.toLocaleLowerCase('tr-TR'));
    return match?.[1] ?? null;
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
    const signals = phaseFiles.flatMap((file) => scanPhaseFileText(file.content, file.name).signals);
    const datedSignals = signals.filter((signal): signal is typeof signal & { date: string } => typeof signal.date === 'string');
    const latestSignalDate = datedSignals.map((signal) => signal.date).sort().at(-1) ?? null;
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
    if (completion && latestSignalDate && latestSignalDate < completion && days(latestSignalDate, completion) > DATE_GAP_DAYS) {
        return {
            status: 'stale',
            nearMissCode: 'date-gap',
            nearMissMessage: `Latest phase-file signal (${latestSignalDate}) predates the roadmap completion date (${completion}) by more than ${DATE_GAP_DAYS} days.`,
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
    const normalizedHeading = group.heading.toLocaleLowerCase('tr-TR');
    const idToken = sliceIdToken(group.heading);
    const mentioned = handoffFiles.some((file) => {
        const haystack = file.content.toLocaleLowerCase('tr-TR');
        if (haystack.includes(normalizedHeading)) return true;
        return idToken !== null && haystack.includes(idToken);
    });
    return mentioned ? 'current' : 'partial';
}

function roadmapBoxStatus(group: PhaseGroup): SyncStatus {
    const fullyDone = group.items.length > 0 && group.items.every((item) => item.status === 'done');
    if (fullyDone) return 'current';
    const anyProgress = group.items.some((item) => item.status === 'done' || item.status === 'partial');
    return anyProgress ? 'partial' : 'missing';
}

export function deriveSyncEntries(groups: PhaseGroup[], files: SyncFileSet): SyncEntry[] {
    const entries: SyncEntry[] = [];
    for (const group of groups) {
        const box = roadmapBoxStatus(group);
        const phase = phaseFileStatus(group, files.phaseFiles);
        const handoff = handoffStatus(group, files.handoffFiles);
        const nearMiss =
            phase.nearMissCode && phase.nearMissMessage
                ? { reasonCode: phase.nearMissCode, message: phase.nearMissMessage }
                : undefined;
        entries.push({
            sliceId: group.heading,
            phaseFile: phase.status,
            roadmapBox: box,
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
