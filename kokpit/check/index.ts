// Dilim 5 · Uyum motoru birleştiricisi: buildCompliance(projectRecord).
//
// Yerel kaynaktan ölçer; GitHub kaynağında ölçemez ve BUNU RAPORLAR —
// measurement:'unmeasured' + reasons ile boş liste asla "temiz" gibi
// sunulmaz (UI-SPEC §10.7#5). Sağlık dört bağımsiz banttır; tek birleşik
// yüzde üretilmez. generatedAt dışındaki tüm alanlar aynı makbuza bağlı
// koşumlarda birebir aynıdır (determinizm nöbetçisi).

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { scanRoadmapText } from '../parser/roadmap';
import type { PhaseGroup } from '../parser/schema';
import type { ProjectRecord } from '../projects/schema';
import { detectBrokenSupersededChains, detectConflicts, type ConflictContext } from './conflicts';
import { detectRuleViolations, sortViolations, type LocalFileSlice, type RuleContext } from './rules';
import { ComplianceReport, type ComplianceCoverage, type ComplianceHealth, type ComplianceReport as ComplianceReportType } from './schema';
import { countSyncStale, deriveSyncEntries, type SyncCommit, type SyncFileSet, type SyncNamedFile } from './sync';

const EXCLUDED_DIRS = new Set([
    'node_modules', '.git', '.kokpit', '.codex-tmp', 'dist', 'build', 'output',
    'test-results', 'coverage', '.next', '.vercel', 'playwright-report', '.github',
    'artifacts', 'vendor',
]);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.vue']);
const MAX_FILES = 400;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_DISCOVERED_ENTRIES = 10_000;

export interface BuildComplianceDeps {
    now?: () => Date;
}

export interface UnmeasuredReason {
    code: string;
    message: string;
}

function emptyCoverage(): ComplianceCoverage {
    return {
        eligibleFiles: 0,
        scannedFiles: 0,
        skippedLargeFiles: 0,
        unreadableFiles: 0,
        skippedSymlinks: 0,
        outsideRootPaths: 0,
        truncated: false,
    };
}

function unmeasuredReport(projectId: string, sourceRevision: string, generatedAt: string, reasons: UnmeasuredReason[]): ComplianceReportType {
    return ComplianceReport.parse({
        version: 1,
        projectId,
        sourceRevision,
        generatedAt,
        measurement: 'unmeasured',
        reasons,
        violations: [],
        sync: [],
        conflicts: [],
        health: { phaseDone: 0, partial: 0, open: 0, syncStale: 0, vioErr: 0, vioWarn: 0, conflictOpen: 0 },
        coverage: emptyCoverage(),
    });
}

interface ScanState {
    coverage: ComplianceCoverage;
    discoveredEntries: number;
}

function collectLocalFiles(root: string, state: ScanState): LocalFileSlice[] {
    const slices: LocalFileSlice[] = [];
    const visit = (dir: string): void => {
        if (state.discoveredEntries >= MAX_DISCOVERED_ENTRIES) {
            state.coverage.truncated = true;
            return;
        }
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of sorted) {
            state.discoveredEntries += 1;
            if (state.discoveredEntries > MAX_DISCOVERED_ENTRIES) {
                state.coverage.truncated = true;
                return;
            }
            const full = join(dir, entry.name);
            if (entry.isSymbolicLink()) {
                state.coverage.skippedSymlinks += 1;
                continue;
            }
            if (entry.isDirectory()) {
                if (EXCLUDED_DIRS.has(entry.name)) continue;
                visit(full);
                continue;
            }
            if (!entry.isFile()) continue;
            if (!CODE_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) continue;
            state.coverage.eligibleFiles += 1;
            try {
                if (statSync(full).size > MAX_FILE_BYTES) {
                    state.coverage.skippedLargeFiles += 1;
                    continue;
                }
                if (slices.length >= MAX_FILES) {
                    state.coverage.truncated = true;
                    continue;
                }
                const content = readFileSync(full, 'utf8');
                const rel = relative(root, full).split(sep).join('/');
                slices.push({ path: rel, content });
                state.coverage.scannedFiles += 1;
            } catch {
                state.coverage.unreadableFiles += 1;
            }
        }
    };
    visit(root);
    return slices;
}

function isInside(root: string, target: string): boolean {
    const rel = relative(root, target);
    return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function containedRealpath(root: string, path: string, state: ScanState): string | null {
    try {
        if (!existsSync(path)) return null;
        const canonical = realpathSync.native(path);
        if (!isInside(root, canonical)) {
            state.coverage.outsideRootPaths += 1;
            return null;
        }
        return canonical;
    } catch {
        return null;
    }
}

function readIfExists(root: string, path: string, state: ScanState): string | null {
    try {
        const canonical = containedRealpath(root, path, state);
        if (!canonical || !statSync(canonical).isFile()) return null;
        if (statSync(canonical).size > MAX_FILE_BYTES) {
            state.coverage.skippedLargeFiles += 1;
            return null;
        }
        return readFileSync(canonical, 'utf8');
    } catch {
        state.coverage.unreadableFiles += 1;
        return null;
    }
}

interface GitEvidence {
    commits: SyncCommit[];
    changedAt: Map<string, string>;
    dirtyPaths: Set<string>;
    historyTruncated: boolean;
}

function readGitEvidence(root: string): GitEvidence | null {
    try {
        const log = execFileSync(
            'git',
            ['-C', root, 'log', '--max-count=513', '--format=@@%cI%x09%s', '--name-only', '--', '.'],
            { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
        );
        const changedAt = new Map<string, string>();
        const commits: SyncCommit[] = [];
        let currentDate = '';
        for (const rawLine of log.split(/\r?\n/)) {
            if (rawLine.startsWith('@@')) {
                const [date = '', ...subjectParts] = rawLine.slice(2).split('\t');
                currentDate = date;
                commits.push({ committedAt: date, subject: subjectParts.join('\t') });
                continue;
            }
            const path = rawLine.trim().replaceAll('\\', '/');
            if (path && currentDate && commits.length <= 512 && !changedAt.has(path)) changedAt.set(path, currentDate);
        }
        const status = execFileSync(
            'git',
            ['-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
            { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
        );
        const dirtyPaths = new Set<string>();
        for (const record of status.split('\0').filter(Boolean)) {
            const path = record.slice(3).split(' -> ').at(-1)?.replaceAll('\\', '/');
            if (path) dirtyPaths.add(path);
        }
        const historyTruncated = commits.length > 512;
        return { commits: commits.slice(0, 512), changedAt, dirtyPaths, historyTruncated };
    } catch {
        return null;
    }
}

function readNamedDirectory(
    root: string,
    relativeDir: string,
    state: ScanState,
    gitEvidence: GitEvidence | null,
    include: (name: string) => boolean,
    limit: number,
): SyncNamedFile[] | null {
    const directory = containedRealpath(root, join(root, relativeDir), state);
    if (!directory) return null;
    try {
        if (!statSync(directory).isDirectory()) return null;
        const files: SyncNamedFile[] = [];
        for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            if (!include(entry.name)) continue;
            if (files.length >= limit) {
                state.coverage.truncated = true;
                continue;
            }
            const candidate = join(directory, entry.name);
            const canonical = containedRealpath(root, candidate, state);
            if (!canonical || !statSync(canonical).isFile()) continue;
            const content = readIfExists(root, canonical, state);
            if (!content) continue;
            const repoPath = relative(root, canonical).split(sep).join('/');
            const modifiedAt = statSync(canonical).mtime.toISOString();
            files.push({
                name: repoPath,
                content,
                modifiedAt,
                lastChangedAt: gitEvidence?.dirtyPaths.has(repoPath) ? modifiedAt : gitEvidence?.changedAt.get(repoPath),
            });
        }
        return files;
    } catch {
        state.coverage.unreadableFiles += 1;
        return null;
    }
}

function healthFrom(groups: PhaseGroup[], syncStale: number, violations: ComplianceReportType['violations'], conflictOpen: number): ComplianceHealth {
    let phaseDone = 0;
    let partial = 0;
    let open = 0;
    for (const group of groups) {
        for (const item of group.items) {
            if (item.status === 'done') phaseDone += 1;
            else if (item.status === 'partial') partial += 1;
            else open += 1;
        }
    }
    return {
        phaseDone,
        partial,
        open,
        syncStale,
        vioErr: violations.filter((violation) => violation.state === 'open' && violation.severity === 'error').length,
        vioWarn: violations.filter((violation) => violation.state === 'open' && violation.severity === 'warning').length,
        conflictOpen,
    };
}

export function buildComplianceReport(input: {
    projectId: string;
    sourceRevision: string;
    planMarkdown: string;
    planPath: string;
    root: string;
    receiptDate: string;
    generatedAt: string;
}): ComplianceReportType {
    const groups = scanRoadmapText(input.planMarkdown, input.planPath).groups;
    const state: ScanState = { coverage: emptyCoverage(), discoveredEntries: 0 };
    const gitEvidence = readGitEvidence(input.root);
    const files = collectLocalFiles(input.root, state);
    const phaseFiles = readNamedDirectory(
        input.root,
        join('.agents', 'phases'),
        state,
        gitEvidence,
        (name) => name.endsWith('.md'),
        64,
    );
    const handoffFiles = readNamedDirectory(
        input.root,
        '.agents',
        state,
        gitEvidence,
        (name) => /^(handoff|next-session).*\.md$/i.test(name),
        32,
    );
    const ledgerText = readIfExists(input.root, join(input.root, '.agents', 'karar-defteri.md'), state);
    const ledgerPath = '.agents/karar-defteri.md';
    const reportSourceRevision = `report-${createHash('sha256').update(JSON.stringify({
        receiptRevision: input.sourceRevision,
        planPath: input.planPath,
        planMarkdown: input.planMarkdown,
        receiptDate: input.receiptDate,
        files,
        phaseFiles,
        handoffFiles,
        ledgerText,
        commits: gitEvidence?.commits ?? null,
        historyTruncated: gitEvidence?.historyTruncated ?? null,
        coverage: state.coverage,
    })).digest('hex').slice(0, 24)}`;

    const ruleContext: RuleContext = { planPath: input.planPath, groups, files, receiptDate: input.receiptDate };
    const detectedViolations = detectRuleViolations(ruleContext);
    const violations = detectedViolations.slice(0, 256);
    let outputTruncated = detectedViolations.length > violations.length;
    const derivedSync = deriveSyncEntries(groups, {
        phaseFiles,
        handoffFiles,
        sliceCommits: gitEvidence?.commits ?? null,
    } satisfies SyncFileSet);
    const sync = derivedSync.slice(0, 128);
    if (derivedSync.length > sync.length) outputTruncated = true;
    const conflictContext: ConflictContext = {
        planText: input.planMarkdown,
        planPath: input.planPath,
        ledgerText,
        ledgerPath,
        fallbackDate: input.receiptDate.slice(0, 10),
    };
    const detectedConflicts = [
        ...detectConflicts(conflictContext),
        ...detectBrokenSupersededChains(conflictContext),
    ];
    const conflicts = detectedConflicts.slice(0, 64);
    if (detectedConflicts.length > conflicts.length) outputTruncated = true;

    let health = healthFrom(groups, countSyncStale(sync), violations, conflicts.filter((entry) => entry.status === 'open-conflict').length);

    // ks-band-delinmesi iç tutarlılık gözcüsü: liste sayıları sağlık bantlarıyla
    // matematiksel olarak eşleşmezse motor KENDİ ihlalini kaydeder.
    let finalViolations = violations;
    const expectedErr = violations.filter((violation) => violation.severity === 'error').length;
    const expectedWarn = violations.filter((violation) => violation.severity === 'warning').length;
    if (expectedErr !== health.vioErr || expectedWarn !== health.vioWarn) {
        finalViolations = sortViolations([
            ...violations,
            {
                id: 'ks-band-delinmesi:compliance-health:0',
                rule: 'ks-band-delinmesi',
                severity: 'error',
                state: 'open',
                targetPath: 'compliance-health',
                message: 'Compliance health bands do not match the violation lists; the engine refused to report an inconsistent snapshot.',
                ruleReference: 'Sağlık bantları bağımsızdır ve liste gerçekleriyle tutarlı olmalıdır',
                contextFriction: 'low',
                changeCount: 0,
            },
        ]).slice(0, 256);
        if (violations.length === 256) outputTruncated = true;
        health = healthFrom(groups, countSyncStale(sync), finalViolations, conflicts.filter((entry) => entry.status === 'open-conflict').length);
    }

    const reasons: UnmeasuredReason[] = [];
    if (!gitEvidence) reasons.push({ code: 'git-history-unavailable', message: 'Git history could not be read; slice/ledger freshness is incomplete.' });
    if (gitEvidence?.historyTruncated) reasons.push({ code: 'git-history-truncated', message: 'Slice freshness used the latest 512 commits; older matching commits were outside the bounded history window.' });
    if (state.coverage.truncated) reasons.push({ code: 'scan-truncated', message: `Coverage is partial: ${state.coverage.scannedFiles}/${state.coverage.eligibleFiles} eligible code files were scanned; at least one scan or metadata-discovery limit was reached.` });
    if (outputTruncated) reasons.push({ code: 'report-records-truncated', message: 'One or more report record lists exceeded their bounded output limits.' });
    if (state.coverage.skippedLargeFiles) reasons.push({ code: 'large-files-skipped', message: `${state.coverage.skippedLargeFiles} eligible files exceeded the per-file scan limit.` });
    if (state.coverage.unreadableFiles) reasons.push({ code: 'unreadable-files', message: `${state.coverage.unreadableFiles} files or metadata directories could not be read.` });
    if (state.coverage.skippedSymlinks) reasons.push({ code: 'symlinks-skipped', message: `${state.coverage.skippedSymlinks} code-tree symbolic links were not followed.` });
    if (state.coverage.outsideRootPaths) reasons.push({ code: 'outside-root-rejected', message: `${state.coverage.outsideRootPaths} metadata paths resolved outside the registered repository root and were rejected.` });
    const measurement = reasons.length ? 'partial' : 'measured';

    return ComplianceReport.parse({
        version: 1,
        projectId: input.projectId,
        sourceRevision: reportSourceRevision,
        generatedAt: input.generatedAt,
        measurement,
        reasons,
        violations: finalViolations,
        sync,
        conflicts,
        health,
        coverage: state.coverage,
    });
}

export async function buildCompliance(projectRecord: ProjectRecord, deps?: BuildComplianceDeps): Promise<ComplianceReportType> {
    const generatedAt = (deps?.now ?? (() => new Date()))().toISOString();
    const sourceRevision = projectRecord.index.revision ?? projectRecord.index.commit ?? projectRecord.index.indexedAt ?? 'unindexed';
    if (projectRecord.source.type !== 'local') {
        return unmeasuredReport(projectRecord.id, sourceRevision, generatedAt, [
            { code: 'no-local-checkout', message: 'Compliance rules measure local working trees; GitHub records have no local checkout.' },
        ]);
    }
    let root: string;
    try {
        root = realpathSync.native(resolve(projectRecord.source.root));
    } catch {
        return unmeasuredReport(projectRecord.id, sourceRevision, generatedAt, [
            { code: 'root-unreadable', message: `The registered local root is not readable: ${projectRecord.source.root}` },
        ]);
    }
    if (!existsSync(root) || !statSync(root).isDirectory()) {
        return unmeasuredReport(projectRecord.id, sourceRevision, generatedAt, [
            { code: 'root-unreadable', message: `The registered local root is not a readable directory: ${projectRecord.source.root}` },
        ]);
    }
    return buildComplianceReport({
        projectId: projectRecord.id,
        sourceRevision,
        planMarkdown: projectRecord.index.planMarkdown,
        planPath: projectRecord.index.planPath,
        root,
        receiptDate: projectRecord.index.indexedAt,
        generatedAt,
    });
}
