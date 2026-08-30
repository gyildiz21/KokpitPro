// Dilim 4 · Remap API yaşam döngüsü — buildRemapReport(projectRecord).
//
// Diyagram servisiyle aynı dürüstlük disiplinini uygular: ölçüm yalnız canlı
// yerel Git çalışma ağacında yapılır. GitHub kaydının yerel checkout'u yoktur,
// bayat makbuz, okunamayan kök ve tarama hatası HTTP hatası DEĞİLDİR —
// 200 + measurement:'unmeasurable' + neden kodları olarak raporlanır; sahte
// boş başarı ÜRETİLMEZ (UI-SPEC §5.3). Render seçiminin tek doğruluk kaynağı
// kanonik makbuz grafiğidir; analiz AJAN A'nın kanonik `analyzeRemap`
// modülüne devredilir, servis yalnız yaşam döngüsü sahibidir. Nihai çıktı
// şemadan geçmeden servis dışına çıkmaz. v1'de önbellek YOKTUR; dosya
// yazılmaz.

import { existsSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildReceiptDiagram, isTestPath } from '../diagram/receipt-adapter';
import { scanImportGraph, type ImportScanResult } from '../importgraph/scan';
import { readLocalRevision, type LocalRevision } from '../projects/local';
import type { ProjectRecord } from '../projects/schema';
import { analyzeRemap } from './analyze';
import { measureProductionFileStats } from './measure';
import { RemapReport, type RemapCoverage, type RemapReport as RemapReportType } from './schema';

export interface BuildRemapReportDeps {
    now?: () => Date;
    /** Varsayılan kanonik analyzeRemap; testler deterministik ikame enjekte eder. */
    analyze?: typeof analyzeRemap;
}

interface ReportReason {
    code: string;
    message: string;
}

function emptyCoverage(): RemapCoverage {
    return {
        eligibleFiles: 0,
        scannedFiles: 0,
        testOrFixtureFiles: 0,
        unresolvedImports: 0,
        renderedNodeCount: 0,
        truncated: false,
    };
}

/** Ölçülemez durum sahte temizlikle gizlenmez: neden kodlarıyla raporlanır. */
function unmeasurableReport(
    projectId: string,
    sourceRevision: string,
    generatedAt: string,
    reasons: ReportReason[],
): RemapReportType {
    return RemapReport.parse({
        version: 1,
        projectId,
        sourceRevision,
        generatedAt,
        measurement: 'unmeasurable',
        reasons,
        coverage: emptyCoverage(),
        suggestions: [],
        truncated: false,
    });
}

export async function buildRemapReport(
    projectRecord: ProjectRecord,
    deps?: BuildRemapReportDeps,
): Promise<RemapReportType> {
    const generatedAt = (deps?.now ?? (() => new Date()))().toISOString();
    const sourceRevision = projectRecord.index.revision ?? projectRecord.index.commit;
    if (projectRecord.source.type !== 'local') {
        return unmeasurableReport(projectRecord.id, sourceRevision, generatedAt, [
            { code: 'no-local-checkout', message: 'Remap analysis measures a local working tree; GitHub records have no local checkout.' },
        ]);
    }
    let root: string;
    try {
        root = realpathSync.native(resolve(projectRecord.source.root));
    } catch {
        return unmeasurableReport(projectRecord.id, sourceRevision, generatedAt, [
            { code: 'root-unreadable', message: `The registered local root is not readable: ${projectRecord.source.root}` },
        ]);
    }
    if (!existsSync(root) || !statSync(root).isDirectory()) {
        return unmeasurableReport(projectRecord.id, sourceRevision, generatedAt, [
            { code: 'root-unreadable', message: `The registered local root is not a readable directory: ${projectRecord.source.root}` },
        ]);
    }
    let current: LocalRevision;
    try {
        current = await readLocalRevision(root);
    } catch (error) {
        return unmeasurableReport(projectRecord.id, sourceRevision, generatedAt, [
            { code: 'revision-check-failed', message: `Live revision check failed: ${error instanceof Error ? error.message : String(error)}` },
        ]);
    }
    const expectedKind = projectRecord.index.revisionKind ?? 'commit';
    const expectedRevision = projectRecord.index.revision ?? projectRecord.index.commit;
    if (
        current.branch !== projectRecord.index.branch ||
        current.commit !== projectRecord.index.commit ||
        current.kind !== expectedKind ||
        current.revision !== expectedRevision
    ) {
        return unmeasurableReport(projectRecord.id, sourceRevision, generatedAt, [
            { code: 'stale-receipt', message: `The receipt does not match the live working tree; re-index the project. Expected ${expectedKind}:${expectedRevision}, found ${current.kind}:${current.revision}.` },
        ]);
    }
    let scan: ImportScanResult;
    try {
        scan = await scanImportGraph({ rootDir: root });
    } catch (error) {
        return unmeasurableReport(projectRecord.id, sourceRevision, generatedAt, [
            { code: 'scan-failed', message: `Import graph scan failed: ${error instanceof Error ? error.message : String(error)}` },
        ]);
    }
    // Render seçimi tek doğruluk kaynağı: kanonik makbuz grafiğinin düğümleri.
    // Analizör render dışı hedef için düğüm kimliği UYDURAMAZ.
    const receipt = buildReceiptDiagram({
        projectId: projectRecord.id,
        branch: projectRecord.index.branch,
        commit: projectRecord.index.commit,
        revisionKind: projectRecord.index.revisionKind ?? 'commit',
        revision: projectRecord.index.revision ?? projectRecord.index.commit,
        generatedAt,
        scan,
        groups: projectRecord.index.groups,
    });
    // validateDiagramGraph path'siz düğümü reddeder; filtre tip-düzeyinde bir
    // korumadır, koşumda asla düğüm düşürmez.
    const renderedNodePaths = receipt.graph.nodes
        .map((node) => node.path)
        .filter((path): path is string => typeof path === 'string');
    // Büyük-dosya ölçümü canlı yolda atlanamaz: üretim dosyaları gerçekten
    // ölçülüp fileStats analizöre verilir; aksi hâlde large-file kuralı ölü
    // kalır ve rapor kalıcı 'partial' olur (AJAN D denetim bulgusu 1).
    const productionPaths = scan.nodes
        .map((node) => node.path)
        .filter((path) => !isTestPath(path) && !isFixturePath(path) && !isGeneratedPath(path));
    const { stats: fileStats } = measureProductionFileStats(root, productionPaths);
    const analyze = deps?.analyze ?? analyzeRemap;
    const report = await analyze({ projectId: projectRecord.id, sourceRevision, generatedAt, scan, renderedNodePaths, fileStats });
    // Nihai kapı: rapor şemadan geçmeden servis dışına çıkmaz.
    return RemapReport.parse(report);
}

/** analyze.ts ile aynı dışlama tanımları — sürüklenme nöbetçisi analyze.test.ts'tedir. */
function isFixturePath(path: string): boolean {
    return /(^|\/)__fixtures__(\/|$)/i.test(path);
}

function isGeneratedPath(path: string): boolean {
    return /(^|\/)(generated|__generated__)(\/|$)/i.test(path);
}
