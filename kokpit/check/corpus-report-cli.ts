// Dilim 5.2 · Korpus raporu CLI koşucusu (salt okunur tarama).
//
// Kullanım:
//   tsx kokpit/check/corpus-report-cli.ts --root <dizin> --plan <göreli yol> --out <json>
//
// <root>/<plan> ve <root>/.agents/karar-defteri.md SALT OKUNUR okunur;
// başka hiçbir şeye dokunulmaz, tek yazma --out ile bildirilen rapordur.
// Defter yoksa rapor boş kapsamla dürüstçe üretilir — uydurma yapılmaz.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { analyzeConflictCorpus } from './corpus-report';
import type { ConflictContext } from './conflicts';

function argValue(flag: string): string | null {
    const index = process.argv.indexOf(flag);
    if (index < 0) return null;
    return process.argv[index + 1] ?? null;
}

const root = argValue('--root');
const planRelative = argValue('--plan');
const out = argValue('--out');

if (!root || !planRelative || !out) {
    console.error('Kullanım: tsx kokpit/check/corpus-report-cli.ts --root <dizin> --plan <göreli yol> --out <json>');
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

const ctx: ConflictContext = {
    planText: readFileSync(planFull, 'utf8'),
    planPath,
    ledgerText,
    ledgerPath,
    fallbackDate: new Date().toISOString().slice(0, 10),
};

const report = analyzeConflictCorpus(ctx);
const outPath = resolve(out);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    out: outPath,
    rawCandidateCount: report.rawCandidateCount,
    retainedCandidates: report.retainedCandidates.length,
    rejectionCounts: report.rejectionCounts,
    truncationReasons: report.truncationReasons,
    scannedScope: report.scannedScope,
}, null, 2));
