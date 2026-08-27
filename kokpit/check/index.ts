// Dilim 5 · Uyum motoru birleştiricisi: buildCompliance(projectRecord).
//
// Yerel kaynaktan ölçer; GitHub kaynağında ölçemez ve BUNU RAPORLAR —
// measurement:'unmeasured' + reasons ile boş liste asla "temiz" gibi
// sunulmaz (UI-SPEC §10.7#5). Sağlık dört bağımsiz banttır; tek birleşik
// yüzde üretilmez. generatedAt dışındaki tüm alanlar aynı makbuza bağlı
// koşumlarda birebir aynıdır (determinizm nöbetçisi).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { scanRoadmapText } from '../parser/roadmap';
import type { PhaseGroup } from '../parser/schema';
import type { ProjectRecord } from '../projects/schema';
import { detectBrokenSupersededChains, detectConflicts, type ConflictContext } from './conflicts';
import { detectRuleViolations, sortViolations, type LocalFileSlice, type RuleContext } from './rules';
import { ComplianceReport, type ComplianceHealth, type ComplianceReport as ComplianceReportType } from './schema';
import { countSyncStale, deriveSyncEntries, type SyncFileSet } from './sync';

const EXCLUDED_DIRS = new Set([
    'node_modules', '.git', '.kokpit', '.codex-tmp', 'dist', 'build', 'output',
    'test-results', 'coverage', '.next', '.vercel', 'playwright-report', '.github',
    'artifacts', 'vendor',
]);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.vue']);
const MAX_FILES = 400;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_SCAN_FILES_PER_DIR = 200;

export interface BuildComplianceDeps {
    now?: () => Date;
}

export interface UnmeasuredReason {
    code: string;
    message: string;
}

function unmeasuredReport(projectId: string, generatedAt: string, reasons: UnmeasuredReason[]): ComplianceReportType {
    return ComplianceReport.parse({
        version: 1,
        projectId,
        generatedAt,
        measurement: 'unmeasured',
        reasons,
        violations: [],
        sync: [],
        conflicts: [],
        health: { phaseDone: 0, partial: 0, open: 0, syncStale: 0, vioErr: 0, vioWarn: 0, conflictOpen: 0 },
    });
}

function collectLocalFiles(root: string): LocalFileSlice[] {
    const slices: LocalFileSlice[] = [];
    const visit = (dir: string, budget: { files: number }): void => {
        if (budget.files <= 0) return;
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
        let scanned = 0;
        for (const entry of sorted) {
            if (budget.files <= 0 || scanned >= MAX_SCAN_FILES_PER_DIR) return;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (EXCLUDED_DIRS.has(entry.name)) continue;
                visit(full, budget);
                continue;
            }
            if (!entry.isFile()) continue;
            scanned += 1;
            if (!CODE_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) continue;
            try {
                if (statSync(full).size > MAX_FILE_BYTES) continue;
                const content = readFileSync(full, 'utf8');
                const rel = relative(root, full).split(sep).join('/');
                slices.push({ path: rel, content });
                budget.files -= 1;
            } catch {
                // Okunamayan dosya atlanır — ölçüm sessizce zenginleştirilmez.
            }
        }
    };
    visit(root, { files: MAX_FILES });
    return slices;
}

function readIfExists(path: string): string | null {
    try {
        if (!existsSync(path) || !statSync(path).isFile()) return null;
        if (statSync(path).size > MAX_FILE_BYTES) return null;
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

function readNamedDirectory(dir: string): { name: string; content: string }[] | null {
    if (!existsSync(dir)) return null;
    try {
        return readdirSync(dir)
            .filter((name) => name.endsWith('.md'))
            .sort()
            .slice(0, 64)
            .map((name) => ({ name, content: readIfExists(join(dir, name)) ?? '' }))
            .filter((file) => file.content.length > 0);
    } catch {
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
    planMarkdown: string;
    planPath: string;
    root: string;
    receiptDate: string;
    generatedAt: string;
}): ComplianceReportType {
    const groups = scanRoadmapText(input.planMarkdown, input.planPath).groups;
    const files = collectLocalFiles(input.root);
    const phaseFiles = readNamedDirectory(join(input.root, '.agents', 'phases'));
    const handoffDir = join(input.root, '.agents');
    const handoffFiles = existsSync(handoffDir)
        ? readdirSync(handoffDir)
            .filter((name) => /^(handoff|next-session).*\.md$/i.test(name))
            .sort()
            .slice(0, 32)
            .map((name) => ({ name, content: readIfExists(join(handoffDir, name)) ?? '' }))
            .filter((file) => file.content.length > 0)
        : null;
    const ledgerText = readIfExists(join(input.root, '.agents', 'karar-defteri.md'));
    const ledgerPath = '.agents/karar-defteri.md';

    const ruleContext: RuleContext = { planPath: input.planPath, groups, files, receiptDate: input.receiptDate };
    const violations = detectRuleViolations(ruleContext);
    const sync = deriveSyncEntries(groups, { phaseFiles, handoffFiles } satisfies SyncFileSet);
    const conflictContext: ConflictContext = {
        planText: input.planMarkdown,
        planPath: input.planPath,
        ledgerText,
        ledgerPath,
        fallbackDate: input.receiptDate.slice(0, 10),
    };
    const conflicts = [
        ...detectConflicts(conflictContext),
        ...detectBrokenSupersededChains(conflictContext),
    ].slice(0, 12);

    const health = healthFrom(groups, countSyncStale(sync), violations, conflicts.filter((entry) => entry.status === 'open-conflict').length);

    // ks-band iç tutarlılık gözcüsü: liste sayıları sağlık bantlarıyla
    // matematiksel olarak eşleşmezse motor KENDİ ihlalini kaydeder.
    let finalViolations = violations;
    const expectedErr = violations.filter((violation) => violation.severity === 'error').length;
    const expectedWarn = violations.filter((violation) => violation.severity === 'warning').length;
    if (expectedErr !== health.vioErr || expectedWarn !== health.vioWarn) {
        finalViolations = sortViolations([
            ...violations,
            {
                id: 'ks-band:compliance-health:0',
                rule: 'ks-band',
                severity: 'error',
                state: 'open',
                targetPath: 'compliance-health',
                message: 'Compliance health bands do not match the violation lists; the engine refused to report an inconsistent snapshot.',
                ruleReference: 'Sağlık bantları bağımsızdır ve liste gerçekleriyle tutarlı olmalıdır',
                contextFriction: 'low',
                changeCount: 0,
            },
        ]);
    }

    return ComplianceReport.parse({
        version: 1,
        projectId: input.projectId,
        generatedAt: input.generatedAt,
        measurement: 'measured',
        reasons: [],
        violations: finalViolations,
        sync,
        conflicts,
        health,
    });
}

export async function buildCompliance(projectRecord: ProjectRecord, deps?: BuildComplianceDeps): Promise<ComplianceReportType> {
    const generatedAt = (deps?.now ?? (() => new Date()))().toISOString();
    if (projectRecord.source.type !== 'local') {
        return unmeasuredReport(projectRecord.id, generatedAt, [
            { code: 'no-local-checkout', message: 'Compliance rules measure local working trees; GitHub records have no local checkout.' },
        ]);
    }
    const root = resolve(projectRecord.source.root);
    if (!existsSync(root)) {
        return unmeasuredReport(projectRecord.id, generatedAt, [
            { code: 'root-unreadable', message: `The registered local root is not readable: ${projectRecord.source.root}` },
        ]);
    }
    return buildComplianceReport({
        projectId: projectRecord.id,
        planMarkdown: projectRecord.index.planMarkdown,
        planPath: projectRecord.index.planPath,
        root,
        receiptDate: projectRecord.index.indexedAt,
        generatedAt,
    });
}
