// Remap öneri motoru — Dilim 4, DESIGN D7.
//
// Saf hesaplayıcı: I/O yok, model çağrısı yok, veri koşulları için throw yok.
// Öneriler yalnız çözümlenmiş ve iki ucu da üretim dosyası olan import
// kenarlarından türetilir; unresolved kenar kanıt OLAMAZ. Kesin 'yanlış
// katman' hükmü üretilmez, otomatik hedef klasör uydurulmaz: cross-layer
// kuralı yalnız 'yerleşimi gözden geçir' dili taşır. Kimlikler ve sonuç
// sırası koşumlar arası deterministiktir; süresel alan (duration) raporda
// hiç bulunmaz.

import type { ImportScanResult } from '../importgraph/scan';
import { architectureGroupIdForPath } from '../diagram/architecture';
import { isTestPath } from '../diagram/receipt-adapter';
import { safeMermaidId } from '../diagram/mermaid-sanitize';
import { REMAP_THRESHOLDS } from './thresholds';
import {
    RemapReport,
    REMAP_REASON_BY_KIND,
    type RemapMetrics,
    type RemapSuggestion,
} from './schema';
import type { ProductionFileStat } from './measure';

// receipt-adapter'daki fixture deseni dışa açılmadığı için birebir tıpkısı burada yaşar.
const FIXTURE_PATH_PATTERN = /(^|\/)__fixtures__(\/|$)/i;
/** Üretilmiş kod dizinleri — ölçüm dışı (PLAN Dilim 4 ölçüm tabanı). */
const GENERATED_PATH_PATTERN = /(^|\/)(generated|__generated__)(\/|$)/i;

export interface RemapAnalyzeInput {
    projectId: string;
    sourceRevision: string;
    generatedAt: string;
    scan: ImportScanResult;
    /** Grafda render edilen düğüm yolları; nodeId yalnız bu kümedeki hedeflere verilir. */
    renderedNodePaths?: readonly string[];
    /** measureProductionFileStats çıktısı; yoksa large-file kanıtı ölçülemez sayılır. */
    fileStats?: ReadonlyMap<string, ProductionFileStat>;
    maxSuggestions?: number;
}

function isProductionPath(path: string): boolean {
    return !isTestPath(path) && !FIXTURE_PATH_PATTERN.test(path) && !GENERATED_PATH_PATTERN.test(path);
}

function compareStrings(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

const KIND_ORDER: ReadonlyArray<RemapSuggestion['kind']> = [
    'large-file',
    'shared-import',
    'cross-layer-placement-review',
];

function compareSuggestions(left: RemapSuggestion, right: RemapSuggestion): number {
    return (
        KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
        compareStrings(left.targetPath, right.targetPath)
    );
}

export function analyzeRemap(input: RemapAnalyzeInput): RemapReport {
    const productionPaths = input.scan.nodes.map((node) => node.path).filter(isProductionPath);
    const productionSet = new Set(productionPaths);

    // Kanıt yalnız iki ucu da üretim olan çözümlü kenarlardan gelir.
    const importersByTarget = new Map<string, Set<string>>();
    for (const edge of input.scan.edges) {
        // Unresolved kenar (resolved=false ya da to=null) asla kanıt değildir.
        if (!edge.resolved || edge.to === null) continue;
        if (!productionSet.has(edge.from) || !productionSet.has(edge.to)) continue;
        let importers = importersByTarget.get(edge.to);
        if (!importers) {
            importers = new Set<string>();
            importersByTarget.set(edge.to, importers);
        }
        importers.add(edge.from);
    }

    const renderedSet = new Set(input.renderedNodePaths ?? []);
    const sourceRevision = input.sourceRevision;
    const candidates: RemapSuggestion[] = [];

    const nodeIdFor = (path: string): string | undefined =>
        renderedSet.has(path) ? safeMermaidId(path) : undefined;

    // Kural 1 — large-file: yalnız ölçülmüş stat'ı olan üretim dosyaları.
    for (const path of productionPaths) {
        const stat = input.fileStats?.get(path);
        if (!stat) continue;
        const overLines = stat.lines !== null && stat.lines >= REMAP_THRESHOLDS.largeFile.minLines;
        const overBytes = stat.bytes >= REMAP_THRESHOLDS.largeFile.minBytes;
        if (!overLines && !overBytes) continue;
        const metrics: RemapMetrics = {};
        if (stat.lines !== null) metrics.lines = stat.lines;
        metrics.bytes = stat.bytes;
        const nodeId = nodeIdFor(path);
        candidates.push({
            id: `remap:large-file:${path}`,
            kind: 'large-file',
            targetPath: path,
            ...(nodeId !== undefined ? { nodeId } : {}),
            reasonCode: REMAP_REASON_BY_KIND['large-file'],
            metrics,
            relatedGroups: [architectureGroupIdForPath(path)],
            sourceRevision,
            proposed: true,
        });
    }

    // Kural 2 ve 3 — fan-in kanıtı: hedef başına üretim importer kümesi.
    for (const [targetPath, importers] of importersByTarget) {
        const importerPaths = [...importers].sort(compareStrings);
        const importerGroupIds = [...new Set(importerPaths.map(architectureGroupIdForPath))].sort(compareStrings);
        const targetGroup = architectureGroupIdForPath(targetPath);
        const foreignGroupIds = importerGroupIds.filter((groupId) => groupId !== targetGroup);

        if (
            importerPaths.length >= REMAP_THRESHOLDS.sharedImport.minImporterFiles &&
            importerGroupIds.length >= REMAP_THRESHOLDS.sharedImport.minImporterGroups
        ) {
            const nodeId = nodeIdFor(targetPath);
            candidates.push({
                id: `remap:shared-import:${targetPath}`,
                kind: 'shared-import',
                targetPath,
                ...(nodeId !== undefined ? { nodeId } : {}),
                reasonCode: REMAP_REASON_BY_KIND['shared-import'],
                metrics: { importerFiles: importerPaths.length, importerGroupCount: importerGroupIds.length },
                relatedPaths: importerPaths.slice(0, 16),
                relatedGroups: importerGroupIds.slice(0, 8),
                sourceRevision,
                proposed: true,
            });
        }

        // Yerleşim-inceleme adayı: asla 'yanlış katman' denmez, hedef klasör üretilmez.
        if (foreignGroupIds.length >= REMAP_THRESHOLDS.crossLayerPlacementReview.minForeignImporterGroups) {
            const nodeId = nodeIdFor(targetPath);
            candidates.push({
                id: `remap:cross-layer-placement-review:${targetPath}`,
                kind: 'cross-layer-placement-review',
                targetPath,
                ...(nodeId !== undefined ? { nodeId } : {}),
                reasonCode: REMAP_REASON_BY_KIND['cross-layer-placement-review'],
                metrics: { importerGroupCount: importerGroupIds.length, foreignGroupCount: foreignGroupIds.length },
                relatedPaths: importerPaths.slice(0, 16),
                relatedGroups: foreignGroupIds.slice(0, 8),
                sourceRevision,
                proposed: true,
            });
        }
    }

    // Kararlı sıra: tür sırası, eşitlikte hedef yol artan.
    candidates.sort(compareSuggestions);

    // Liste sınırı: eşik dosyasındaki üst sınır asla aşılamaz (dondurulmuş sözleşme).
    const maxSuggestions = Math.min(
        Math.max(0, Math.floor(input.maxSuggestions ?? REMAP_THRESHOLDS.maxSuggestions)),
        REMAP_THRESHOLDS.maxSuggestions,
    );
    const truncated = candidates.length > maxSuggestions;
    const suggestions = truncated ? candidates.slice(0, maxSuggestions) : candidates;

    // Ölçüm dürüstlüğü: stat yoksa ya da okunamayan dosya varsa koşu 'partial'dır.
    const reasons: Array<{ code: string; message: string }> = [];
    const statsUnavailable = input.fileStats === undefined;
    let missingStatCount = 0;
    if (!statsUnavailable) {
        for (const path of productionPaths) {
            if (!input.fileStats?.has(path)) missingStatCount += 1;
        }
    }
    if (statsUnavailable) {
        reasons.push({
            code: 'file-stats-unavailable',
            message: 'File size stats were not provided; large-file evidence is unmeasured.',
        });
    }
    if (missingStatCount > 0) {
        reasons.push({
            code: 'unreadable-files',
            message: `${missingStatCount} production files had no readable stat entry and were excluded from large-file evidence.`,
        });
    }
    if (truncated) {
        reasons.push({
            code: 'suggestions-truncated',
            message: `${candidates.length - suggestions.length} candidates beyond the limit of ${maxSuggestions} were dropped.`,
        });
    }

    const report: RemapReport = {
        version: 1,
        projectId: input.projectId,
        sourceRevision,
        generatedAt: input.generatedAt,
        measurement: statsUnavailable || missingStatCount > 0 ? 'partial' : 'measured',
        reasons,
        coverage: {
            eligibleFiles: productionPaths.length,
            scannedFiles: input.scan.scannedFileCount,
            testOrFixtureFiles: input.scan.scannedFileCount - productionPaths.length,
            unresolvedImports: input.scan.unresolvedCount,
            renderedNodeCount: renderedSet.size,
            truncated,
        },
        suggestions,
        truncated,
    };

    // Dondurulmuş sözleşme nöbetçisi: motor kendi çıktısını reddedemez.
    const parsed = RemapReport.safeParse(report);
    if (!parsed.success) {
        throw new Error(
            'analyzeRemap produced an invalid report: ' +
                parsed.error.issues.map((issue) => issue.message).join('; '),
        );
    }
    return parsed.data;
}
