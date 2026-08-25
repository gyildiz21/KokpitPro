// IndexReceipt + import grafı → DiagramGraph adaptörü — Dilim 2.0, adım 4.
//
// Gerçek repo ilişkilerini (scanImportGraph ölçümleri) sürümlü graf
// sözleşmesine çevirir ve her düğüme geri izlenebilir makbuz iliştirir:
// projectId/dal/commit/yol/faz eşlemesi/KANIT TÜRÜ. Kanıt hiyerarşisi dürüsttür:
// - 'measured-import' : dosya gerçekten tarandı, kenarları gerçekten ölçüldü
// - 'plan-path-match' : plan maddesi metni bu dosya yolunu açıkça içeriyor
// - 'unmeasured'      : ne plan bağlantısı ne ölçüm — tahmin ÜRETİLMEZ
// Plan checkbox'ı tek başına hiçbir zaman kod kanıtı sayılmaz.

import type { PhaseGroup } from '../parser/schema';
import type { ImportScanResult } from '../importgraph/scan';
import {
    MAX_GRAPH_EDGES,
    MAX_GRAPH_NODES,
    validateDiagramGraph,
    type DiagramGraph,
} from './graph-schema';
import { safeMermaidId } from './mermaid-sanitize';

/** Düğüm başına kanıt makbuzu — denetçi bu türleri aynen göstermek zorundadır. */
export type NodeEvidenceKind = 'measured-import' | 'plan-path-match' | 'unmeasured';

export interface NodeEvidence {
    projectId: string;
    branch: string;
    commit: string;
    path: string;
    phaseHeading?: string;
    itemId?: string;
    /** Yalnız plan bilgisi; tek başına kod kanıtı DEĞİLDİR. */
    itemStatus?: 'done' | 'partial' | 'open';
    evidenceKind: NodeEvidenceKind;
}

export interface ReceiptDiagramInput {
    projectId: string;
    branch: string;
    commit: string;
    generatedAt: string;
    scan: ImportScanResult;
    groups: PhaseGroup[];
}

export interface ReceiptDiagram {
    graph: DiagramGraph;
    nodeEvidence: Record<string, NodeEvidence>;
    measurements: {
        scannedFileCount: number;
        totalEdgeCount: number;
        renderedNodeCount: number;
        renderedEdgeCount: number;
        unresolvedCount: number;
        durationMs: number;
    };
    /** Path kanıtlı olup seçili düğümlerde karşılığı bulunmayan plan maddeleri — görünür kalır. */
    unmatchedPlanItems: Array<{
        itemId: string;
        phaseHeading: string;
        status: 'done' | 'partial' | 'open';
        mentionedPath: string;
    }>;
}

function posixBasename(path: string): string {
    const segments = path.split('/');
    const last = segments[segments.length - 1];
    return last ?? path;
}

/** Graf-içi çözümlenmiş kenarlardaki derece — düğüm önemi yalnız ölçümden gelir. */
function intraDegree(path: string, scan: ImportScanResult): number {
    let degree = 0;
    for (const edge of scan.edges) {
        if (!edge.resolved || edge.to === null) continue;
        if (edge.from === path || edge.to === path) degree += 1;
    }
    return degree;
}

/**
 * Plan maddesi metnindeki en uzun tarama-yolu eşleşmesi. Sezgisel serbest arama
 * DEĞİLDİR: yalnız tam posix-yol alt-dizesi kanıt sayılır; eşleşmeyen madde
 * 'unmatchedPlanItems'ta görünür kalır.
 */
function longestMentionedPath(text: string, paths: readonly string[]): string | null {
    let best: string | null = null;
    for (const candidate of paths) {
        if (!text.includes(candidate)) continue;
        if (best === null || candidate.length > best.length) best = candidate;
    }
    return best;
}

function extractPathLike(title: string): string {
    const match = /[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|md|json)/.exec(title);
    return match?.[0] ?? '';
}

function compare(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

export function buildReceiptDiagram(input: ReceiptDiagramInput): ReceiptDiagram {
    const { scan } = input;

    // Düğüm seçimi ölçüme dayanır: graf-içi derece, eşitlikte alfabetik yol.
    // Sessiz uydurma yok; kırpılan düğümler measurements'ta dürüstçe raporlanır.
    const ranked = [...scan.nodes]
        .map((node) => ({ path: node.path, degree: intraDegree(node.path, scan) }))
        .sort((left, right) => right.degree - left.degree || compare(left.path, right.path));
    const selectedPaths = ranked.slice(0, MAX_GRAPH_NODES).map((entry) => entry.path);
    const selectedSet = new Set(selectedPaths);

    const idByPath = new Map<string, string>();
    for (const path of selectedPaths) idByPath.set(path, safeMermaidId(path));

    const flatItems = input.groups.flatMap((group) =>
        group.items.map((item) => ({
            phaseHeading: group.heading,
            itemId: `${group.heading}::${item.id}`,
            status: item.status,
            title: item.title,
        })),
    );

    const nodeEvidence: Record<string, NodeEvidence> = {};
    const unmatchedPlanItems: ReceiptDiagram['unmatchedPlanItems'] = [];

    for (const item of flatItems) {
        const mentioned = longestMentionedPath(item.title, selectedPaths);
        if (mentioned === null) {
            unmatchedPlanItems.push({
                itemId: item.itemId,
                phaseHeading: item.phaseHeading,
                status: item.status,
                mentionedPath: extractPathLike(item.title),
            });
            continue;
        }
        // İlk eşleşen madde kazanır — flatItems plan sırasındadır, deterministiktir.
        const nodeId = idByPath.get(mentioned);
        if (nodeId !== undefined && !nodeEvidence[nodeId]) {
            nodeEvidence[nodeId] = {
                projectId: input.projectId,
                branch: input.branch,
                commit: input.commit,
                path: mentioned,
                phaseHeading: item.phaseHeading,
                itemId: item.itemId,
                itemStatus: item.status,
                evidenceKind: 'plan-path-match',
            };
        }
    }

    const graphNodes = selectedPaths.map((path) => ({
        id: idByPath.get(path)!,
        label: posixBasename(path),
        type: 'box' as const,
        path,
    }));

    const renderedEdges = scan.edges
        .filter(
            (edge): edge is typeof edge & { to: string } =>
                edge.resolved &&
                typeof edge.to === 'string' &&
                selectedSet.has(edge.from) &&
                selectedSet.has(edge.to),
        )
        .sort(
            (left, right) =>
                compare(left.from, right.from) ||
                compare(left.to ?? '', right.to ?? '') ||
                compare(left.raw ?? '', right.raw ?? ''),
        )
        .slice(0, MAX_GRAPH_EDGES)
        .map((edge) => ({
            from: idByPath.get(edge.from)!,
            to: idByPath.get(edge.to)!,
            style: 'solid' as const,
        }));
    // Ölçümü/plan bağlantısı olmayan düğümler 'unmeasured' kalır — durum boyaması
    // UI katmanının dürüstlük kuralıdır (renk tek başına durum taşımaz).
    for (const path of selectedPaths) {
        const nodeId = idByPath.get(path)!;
        if (!nodeEvidence[nodeId]) {
            nodeEvidence[nodeId] = {
                projectId: input.projectId,
                branch: input.branch,
                commit: input.commit,
                path,
                evidenceKind: 'unmeasured',
            };
        }
    }

    const validation = validateDiagramGraph({
        schemaVersion: 1,
        metadata: {
            projectId: input.projectId,
            branch: input.branch,
            commit: input.commit,
            generatedAt: input.generatedAt,
        },
        groups: [],
        nodes: graphNodes,
        edges: renderedEdges,
    });
    if (!validation.valid || !validation.graph) {
        throw new Error(
            'buildReceiptDiagram produced an invalid graph: ' +
                validation.issues.map((issue) => issue.message).join('; '),
        );
    }
    const graph: DiagramGraph = validation.graph;

    return {
        graph,
        nodeEvidence,
        measurements: {
            scannedFileCount: scan.scannedFileCount,
            totalEdgeCount: scan.edges.length,
            renderedNodeCount: graph.nodes.length,
            renderedEdgeCount: graph.edges.length,
            unresolvedCount: scan.unresolvedCount,
            durationMs: scan.durationMs,
        },
        unmatchedPlanItems,
    };
}
