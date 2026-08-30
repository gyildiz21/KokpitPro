// Dilim 4 · buildRemapReport yaşam döngüsü nöbetçileri.
//
// Analizör AJAN A'nın kanonik modülüdür; bu dalda entegrasyon sapı fırlatır.
// Testler sözleşmeye uygun EL YAPIMI deterministik analizörü enjekte eder —
// sahte yalnız testte serbesttir, üretim yolu sahte İÇERMEZ. Geçici Git
// depoları hermetiktir: her test kendi tmpdir kökünü kurup kapatır
// (projects.test.ts desenindeki gibi).

import { execFile } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { indexLocalProject } from '../../projects/local';
import { ProjectRecord } from '../../projects/schema';
import { analyzeRemap } from '../analyze';
import { RemapReport, type RemapReport as RemapReportType } from '../schema';
import { buildRemapReport } from '../service';

const execFileAsync = promisify(execFile);

const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function git(root: string, args: string[]): Promise<void> {
    await execFileAsync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
}

async function createTempRepo(): Promise<string> {
    const directory = mkdtempSync(resolve(tmpdir(), 'kokpit-remap-'));
    temporaryDirectories.push(directory);
    const repo = resolve(directory, 'repo');
    mkdirSync(repo);
    await git(repo, ['init', '-b', 'main']);
    await git(repo, ['config', 'user.email', 'kokpit-test@example.com']);
    await git(repo, ['config', 'user.name', 'Kokpit Test']);
    return repo;
}

function writeRepoFiles(repo: string, prefix: string): void {
    mkdirSync(resolve(repo, 'src'));
    writeFileSync(resolve(repo, 'src', `${prefix}-a.ts`), `import { helper } from './${prefix}-b';\nexport const main = () => helper();\n`);
    writeFileSync(resolve(repo, 'src', `${prefix}-b.ts`), 'export const helper = () => 1;\n');
    writeFileSync(resolve(repo, 'PLAN.md'), '# Plan\n\n## Faz A\n- [x] **Madde 1:** `src/` modülleri tamamlandı\n');
}

async function commitAll(repo: string): Promise<void> {
    await git(repo, ['add', '-A']);
    await git(repo, ['commit', '-m', 'kurulum']);
}

type AnalyzeFn = typeof analyzeRemap;
type AnalyzeCall = Parameters<AnalyzeFn>[0];

/** Sözleşmeye uygun ölçülmüş rapor: enjekte edilen analizörün tek çıktı kalıbı. */
function measuredReport(input: AnalyzeCall): RemapReportType {
    // Entegrasyon: kanonik sözleşmede renderedNodePaths opsiyoneldir.
    const rendered = input.renderedNodePaths ?? [];
    return {
        version: 1,
        projectId: input.projectId,
        sourceRevision: input.sourceRevision,
        generatedAt: input.generatedAt,
        measurement: 'measured',
        reasons: [],
        coverage: {
            eligibleFiles: rendered.length,
            scannedFiles: rendered.length,
            testOrFixtureFiles: 0,
            unresolvedImports: 0,
            renderedNodeCount: rendered.length,
            truncated: false,
        },
        suggestions: rendered.map((path) => ({
            id: `sugg:${path}`,
            kind: 'large-file',
            targetPath: path,
            reasonCode: 'size-over-threshold',
            metrics: { lines: 500 },
            relatedGroups: ['shared'],
            sourceRevision: input.sourceRevision,
            proposed: true,
        })),
        truncated: false,
    };
}

function fakeAnalyzer(): { analyze: AnalyzeFn; calls: AnalyzeCall[] } {
    const calls: AnalyzeCall[] = [];
    const analyze: AnalyzeFn = (input) => {
        calls.push(input);
        return measuredReport(input);
    };
    return { analyze, calls };
}

describe('buildRemapReport yaşam döngüsü', () => {
    it('ölçülmüş yerel projede sözleşmeye uygun measured rapor döndürür', async () => {
        const repo = await createTempRepo();
        writeRepoFiles(repo, 'alpha');
        await commitAll(repo);
        const record = await indexLocalProject({ path: repo, planPath: 'PLAN.md', name: 'Remap Test' });
        const { analyze, calls } = fakeAnalyzer();

        const report = await buildRemapReport(record, { analyze });

        expect(report.measurement).toBe('measured');
        expect(report.projectId).toBe(record.id);
        expect(report.sourceRevision).toBe(record.index.revision ?? record.index.commit);
        RemapReport.parse(report); // servis zaten şemadan geçirdi; nöbetçi yeniden doğrular
        expect(calls).toHaveLength(1);
        // Render seçimi kanonik makbuzdan: her üretim dosyası ölçülmüş düğüm olur.
        expect(calls[0]?.renderedNodePaths).toEqual(['src/alpha-a.ts', 'src/alpha-b.ts']);
        expect(report.suggestions.map((suggestion) => suggestion.targetPath)).toEqual(['src/alpha-a.ts', 'src/alpha-b.ts']);
    });

    it('bayat çalışma ağacında unmeasurable/stale-receipt döner; analizör çağrılmaz', async () => {
        const repo = await createTempRepo();
        writeRepoFiles(repo, 'alpha');
        await commitAll(repo);
        const record = await indexLocalProject({ path: repo, planPath: 'PLAN.md' });
        // İzlenen dosyayı kirlet: canlı makbuz artık kayıttan farklıdır.
        appendFileSync(resolve(repo, 'src', 'alpha-a.ts'), '\n// kirli satır\n');
        const { analyze, calls } = fakeAnalyzer();

        const report = await buildRemapReport(record, { analyze });

        expect(report.measurement).toBe('unmeasurable');
        expect(report.reasons.map((reason) => reason.code)).toEqual(['stale-receipt']);
        expect(report.suggestions).toEqual([]);
        expect(report.coverage).toEqual({
            eligibleFiles: 0,
            scannedFiles: 0,
            testOrFixtureFiles: 0,
            unresolvedImports: 0,
            renderedNodeCount: 0,
            truncated: false,
        });
        expect(report.truncated).toBe(false);
        expect(calls).toHaveLength(0);
    });

    it('GitHub kaydında unmeasurable/no-local-checkout döner; dosya sistemine dokunmaz', async () => {
        const repo = await createTempRepo();
        writeRepoFiles(repo, 'alpha');
        await commitAll(repo);
        const local = await indexLocalProject({ path: repo, planPath: 'PLAN.md' });
        const record = ProjectRecord.parse({
            ...local,
            id: 'github-proje',
            source: { type: 'github', owner: 'owner', repo: 'repo', htmlUrl: 'https://github.com/owner/repo', private: false },
            authMode: 'anonymous',
        });
        const { analyze, calls } = fakeAnalyzer();

        const report = await buildRemapReport(record, { analyze });

        expect(report.measurement).toBe('unmeasurable');
        expect(report.reasons).toEqual([
            { code: 'no-local-checkout', message: 'Remap analysis measures a local working tree; GitHub records have no local checkout.' },
        ]);
        expect(report.suggestions).toEqual([]);
        expect(calls).toHaveLength(0);
    });

    it('repo içi kök-dışı symlink ölçümü bozmaz; kök dışı yol düğüm olmaz', async () => {
        const repo = await createTempRepo();
        writeRepoFiles(repo, 'alpha');
        // Sınır: symlink repo içinde durur ama KÖK DIŞINA çözülür.
        const outside = resolve(repo, '..', 'kokpit-disi-secret.ts');
        writeFileSync(outside, 'export const secret = 1;\n');
        symlinkSync(outside, resolve(repo, 'src', 'alpha-link.ts'));
        await commitAll(repo);
        const record = await indexLocalProject({ path: repo, planPath: 'PLAN.md' });
        const { analyze, calls } = fakeAnalyzer();

        const report = await buildRemapReport(record, { analyze });

        expect(report.measurement).toBe('measured');
        expect(calls).toHaveLength(1);
        const paths = calls[0]?.renderedNodePaths ?? [];
        expect(paths).toEqual(['src/alpha-a.ts', 'src/alpha-b.ts']);
        expect(paths).not.toContain('src/alpha-link.ts');
        expect(report.suggestions.map((suggestion) => suggestion.targetPath)).not.toContain('src/alpha-link.ts');
    });

    it('aynı revisionda iki koşum birebir aynı raporu üretir (generatedAt sabitlenmiş)', async () => {
        const repo = await createTempRepo();
        writeRepoFiles(repo, 'alpha');
        await commitAll(repo);
        const record = await indexLocalProject({ path: repo, planPath: 'PLAN.md' });
        const now = () => new Date('2026-08-29T09:00:00.000Z');

        const first = await buildRemapReport(record, { now, analyze: fakeAnalyzer().analyze });
        const second = await buildRemapReport(record, { now, analyze: fakeAnalyzer().analyze });

        expect(first.generatedAt).toBe('2026-08-29T09:00:00.000Z');
        expect(second).toEqual(first);
    });

    it('iki proje aynı koşumda veri karıştırmaz: kimlik ve yollar ayrı kalır', async () => {
        const repoA = await createTempRepo();
        writeRepoFiles(repoA, 'alpha');
        await commitAll(repoA);
        const repoB = await createTempRepo();
        writeRepoFiles(repoB, 'beta');
        await commitAll(repoB);
        const recordA = await indexLocalProject({ path: repoA, planPath: 'PLAN.md', name: 'Proje A' });
        const recordB = await indexLocalProject({ path: repoB, planPath: 'PLAN.md', name: 'Proje B' });
        const { analyze, calls } = fakeAnalyzer();

        const reportA = await buildRemapReport(recordA, { analyze });
        const reportB = await buildRemapReport(recordB, { analyze });

        expect(reportA.projectId).toBe(recordA.id);
        expect(reportB.projectId).toBe(recordB.id);
        expect(calls).toHaveLength(2);
        const alphaTargets = reportA.suggestions.map((suggestion) => suggestion.targetPath);
        const betaTargets = reportB.suggestions.map((suggestion) => suggestion.targetPath);
        expect(alphaTargets).toEqual(['src/alpha-a.ts', 'src/alpha-b.ts']);
        expect(betaTargets).toEqual(['src/beta-a.ts', 'src/beta-b.ts']);
        expect(alphaTargets.some((path) => path.includes('beta'))).toBe(false);
        expect(betaTargets.some((path) => path.includes('alpha'))).toBe(false);
    });
});
