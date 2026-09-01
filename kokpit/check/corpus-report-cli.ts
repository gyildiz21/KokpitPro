// Dilim 5.2 · Korpus raporu CLI koşucusu (salt okunur tarama).
//
// Kullanım:
//   tsx kokpit/check/corpus-report-cli.ts --root <dizin> --plan <göreli yol> --out <json>
//
// <root>/<plan> ve <root>/.agents/karar-defteri.md SALT OKUNUR okunur;
// başka hiçbir şeye dokunulmaz, tek yazma --out ile bildirilen rapordur.
// Çıktı kaynak/motor revision'ı ile PLAN/defter/motor SHA-256 hashlerini taşır;
// mutlak korpus kökü JSON'a yazılmaz. Defter yoksa rapor boş kapsamla
// dürüstçe üretilir — uydurma yapılmaz.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    analyzeConflictCorpus,
    createConflictCorpusReceipt,
    sha256Text,
    type CorpusRevisionReceipt,
} from './corpus-report';
import type { ConflictContext } from './conflicts';

function argValue(flag: string): string | null {
    const index = process.argv.indexOf(flag);
    if (index < 0) return null;
    return process.argv[index + 1] ?? null;
}

const root = argValue('--root');
const planRelative = argValue('--plan');
const out = argValue('--out');
const measuredAtInput = argValue('--measured-at');
const fallbackDateInput = argValue('--fallback-date');

if (!root || !planRelative || !out) {
    console.error('Kullanım: tsx kokpit/check/corpus-report-cli.ts --root <dizin> --plan <göreli yol> --out <json> [--measured-at <ISO>] [--fallback-date <YYYY-MM-DD>]');
    process.exit(2);
}

const measuredAt = measuredAtInput ?? new Date().toISOString();
if (Number.isNaN(Date.parse(measuredAt))) {
    console.error('--measured-at geçerli bir ISO tarih-zamanı olmalıdır.');
    process.exit(2);
}
const fallbackDate = fallbackDateInput ?? measuredAt.slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)) {
    console.error('--fallback-date YYYY-MM-DD biçiminde olmalıdır.');
    process.exit(2);
}

const rootDir = resolve(root);
const planPath = planRelative.replaceAll('\\', '/');
const planFull = join(rootDir, planRelative);
if (!existsSync(planFull)) {
    console.error(`Plan okunamadı (salt okunur tarama): ${planFull}`);
    process.exit(1);
}

const ledgerPath = '.agents/karar-defteri.md';
const ledgerFull = join(rootDir, ledgerPath);
const ledgerText = existsSync(ledgerFull) ? readFileSync(ledgerFull, 'utf8') : null;
const planText = readFileSync(planFull, 'utf8');
const planSha256 = sha256Text(planText);
const ledgerSha256 = ledgerText === null ? null : sha256Text(ledgerText);

function gitRevision(repoRoot: string, contentFingerprint: string): CorpusRevisionReceipt {
    try {
        const common = ['-c', `safe.directory=${repoRoot}`, '-C', repoRoot];
        const commit = execFileSync('git', [...common, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        const status = execFileSync('git', [...common, 'status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        const revisionKind = status ? 'working-tree' : 'commit';
        return {
            commit,
            revisionKind,
            revision: revisionKind === 'commit' ? commit : `${commit}+working-tree:${contentFingerprint.slice(0, 16)}`,
        };
    } catch {
        return {
            commit: null,
            revisionKind: 'unversioned',
            revision: `unversioned:${contentFingerprint.slice(0, 16)}`,
        };
    }
}

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const engineSha256 = sha256Text([
    readFileSync(resolve(engineRoot, 'kokpit/check/conflicts.ts'), 'utf8'),
    readFileSync(resolve(engineRoot, 'kokpit/check/corpus-report.ts'), 'utf8'),
    readFileSync(resolve(engineRoot, 'kokpit/check/corpus-report-cli.ts'), 'utf8'),
].join('\n--- kokpit-engine-input ---\n'));
const sourceFingerprint = sha256Text(`${planSha256}:${ledgerSha256 ?? 'missing-ledger'}`);

const ctx: ConflictContext = {
    planText,
    planPath,
    ledgerText,
    ledgerPath,
    fallbackDate,
};

const report = analyzeConflictCorpus(ctx);
const receipt = createConflictCorpusReceipt(report, {
    measuredAt,
    fallbackDate,
    planPath,
    ledgerPath,
    planSha256,
    ledgerSha256,
    engineSha256,
    source: gitRevision(rootDir, sourceFingerprint),
    engine: gitRevision(engineRoot, engineSha256),
});
const outPath = resolve(out);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    out: outPath,
    reportId: receipt.provenance.reportId,
    sourceRevision: receipt.provenance.source.revision,
    engineRevision: receipt.provenance.engine.revision,
    rawCandidateCount: receipt.rawCandidateCount,
    retainedCandidates: receipt.retainedCandidates.length,
    rejectionCounts: receipt.rejectionCounts,
    truncationReasons: receipt.truncationReasons,
    scannedScope: receipt.scannedScope,
}, null, 2));
