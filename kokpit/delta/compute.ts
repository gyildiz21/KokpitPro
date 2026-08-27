// Plan maddesi ↔ ölçülmüş graf deltası — Dilim 3 · Delta.
//
// computeDelta, plan maddesinin metin bildirimlerini makbuz diyagramındaki
// gerçek ölçümlerle karşılaştırır ve dürüst bir DeltaResult üretir:
// - 'measured'     : madde, makbuz eşlemesiyle gerçek düğüm/test yüzeyine bağlandı
// - 'declared-only': yalnız metinden yol bildirimi var; ölçüm yok, kenar uydurulmaz
// - 'unmeasurable' : madde yok / bayat makbuz / canlı Checkout yok — liste boş kalır
// Nöbetçi ilkeler: bilinmeyen düğüm kimliği TypeError'la patlar; öneri
// düğümlerine asla kenar eklenmez; karşılaştırma yalnız verilen baseline ile.
// Modül saftır: I/O yok, global durum yok; aynı girdi (durationMs hariç)
// birebir aynı çıktıyı verir.

import type { PhaseGroup } from '../parser/schema';
import type { ReceiptDiagram } from '../diagram/receipt-adapter';
import { safeMermaidId } from '../diagram/mermaid-sanitize';
import {
    BaseRevision,
    DeltaResult,
    type DeltaMode,
    type DeltaReason,
    type EdgeRef,
    type EvidenceKind,
    type ProposedNode,
} from './schema';

export interface DeltaComputeInput {
    projectId: string;
    phaseHeading: string;
    itemKey: string;
    receipt: {
        branch: string;
        commit: string;
        revisionKind?: 'commit' | 'working-tree';
        revision?: string;
        groups: PhaseGroup[];
    };
    diagram: ReceiptDiagram | null;
    liveRevision: {
        kind: 'commit' | 'working-tree';
        revision: string;
        commit: string;
        branch: string;
    } | null;
    /** Verilmediyse (undefined/null) kenar karşılaştırması yapılmaz — uydurma yasak. */
    baselineDiagram?: Pick<ReceiptDiagram, 'graph'> | null;
}

/** Madde başlığındaki yol-benzeri bildirimler — receipt-adapter deseniyle aynı. */
const DECLARED_PATH_PATTERN = /[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|md|json)/g;

const MAX_DECLARED_PATHS = 64;
const MAX_AFFECTED = 64;
const MAX_PROPOSED_NODES = 32;
const MAX_EDGES = 128;
const MAX_REASONS = 16;

interface EdgeTuple {
    from: string;
    to: string;
}

function compare(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function compareEdges(left: EdgeTuple, right: EdgeTuple): number {
    return compare(left.from, right.from) || compare(left.to, right.to);
}

function uniqueSorted(values: Iterable<string>): string[] {
    return [...new Set(values)].sort(compare);
}

function posixBasename(path: string): string {
    const segments = path.split('/');
    const last = segments[segments.length - 1];
    return last ?? path;
}

function edgeKey(edge: EdgeTuple): string {
    return `${edge.from}\n${edge.to}`;
}

/**
 * Düğüm kümesine değen (uçlarından en az biri kümede olan) kenarları toplar,
 * tekilleştirir ve from,to sırasına dizer. Madde kapsamı dışındaki graf
 * kenarları deltaya sızmaz.
 */
function incidentEdges(
    graphEdges: readonly { from: string; to: string }[],
    nodeIds: ReadonlySet<string>,
): EdgeTuple[] {
    const seen = new Set<string>();
    const edges: EdgeTuple[] = [];
    for (const edge of graphEdges) {
        if (!nodeIds.has(edge.from) && !nodeIds.has(edge.to)) continue;
        const key = edgeKey(edge);
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: edge.from, to: edge.to });
    }
    return edges.sort(compareEdges);
}

function diffEdges(current: readonly EdgeTuple[], baseline: readonly EdgeTuple[]): {
    added: EdgeTuple[];
    removed: EdgeTuple[];
} {
    const baselineKeys = new Set(baseline.map(edgeKey));
    const currentKeys = new Set(current.map(edgeKey));
    return {
        added: current.filter((edge) => !baselineKeys.has(edgeKey(edge))),
        removed: baseline.filter((edge) => !currentKeys.has(edgeKey(edge))),
    };
}

function reasonComparator(left: DeltaReason, right: DeltaReason): number {
    return compare(left.code, right.code) || compare(left.message, right.message);
}

export function computeDelta(input: DeltaComputeInput): DeltaResult {
    const startedAt = performance.now();

    const itemId = `${input.phaseHeading}::${input.itemKey}`;
    const baseRevision: BaseRevision = {
        kind: input.receipt.revisionKind ?? 'commit',
        revision: input.receipt.revision ?? input.receipt.commit,
        commit: input.receipt.commit,
        branch: input.receipt.branch,
    };

    // Nöbetçi 1: madde aranır. Yoksa ölçümün hiçbir katmanı çalışmaz.
    const group = input.receipt.groups.find((candidate) => candidate.heading === input.phaseHeading);
    const item = group?.items.find((candidate) => candidate.id === input.itemKey);

    let declaredPaths: string[] = [];
    if (group && item) {
        declaredPaths = uniqueSorted(item.title.match(DECLARED_PATH_PATTERN) ?? []).slice(0, MAX_DECLARED_PATHS);
    }

    const finalize = (
        mode: DeltaMode,
        evidenceKind: EvidenceKind,
        reasons: DeltaReason[],
        lists: {
            declaredPaths: string[];
            affectedNodeIds: string[];
            affectedPaths: string[];
            affectedTests: string[];
            proposedNodes: ProposedNode[];
            addedEdges: EdgeRef[];
            removedEdges: EdgeRef[];
        },
    ): DeltaResult => {
        const result: DeltaResult = {
            schemaVersion: 1,
            projectId: input.projectId,
            itemId,
            phaseHeading: input.phaseHeading,
            mode,
            baseRevision,
            declaredPaths: lists.declaredPaths,
            affectedNodeIds: lists.affectedNodeIds,
            affectedPaths: lists.affectedPaths,
            affectedTests: lists.affectedTests,
            proposedNodes: lists.proposedNodes,
            addedEdges: lists.addedEdges,
            removedEdges: lists.removedEdges,
            evidenceKind,
            reasons: [...reasons].sort(reasonComparator).slice(0, MAX_REASONS),
            durationMs: Math.max(0, performance.now() - startedAt),
        };
        // Değişmez nöbetçisi: üretilen sonuç kendi şemasından geçmelidir.
        const parsed = DeltaResult.safeParse(result);
        if (!parsed.success) {
            throw new Error(
                'computeDelta produced an invalid DeltaResult: ' +
                    parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
            );
        }
        return parsed.data;
    };

    const unmeasurableLists = {
        declaredPaths,
        affectedNodeIds: [],
        affectedPaths: [],
        affectedTests: [],
        proposedNodes: [],
        addedEdges: [],
        removedEdges: [],
    };

    if (!group || !item) {
        return finalize('unmeasurable', 'none', [
            {
                code: 'item-not-found',
                message: `Plan item "${itemId}" was not found in the receipt groups.`,
            },
        ], unmeasurableLists);
    }

    // Nöbetçi 2: bayatlık. Canlı Checkout yoksa ya da damga uyuşmuyorsa delta yasak.
    const live = input.liveRevision;
    if (live === null) {
        return finalize('unmeasurable', 'none', [
            {
                code: 'no-local-checkout',
                message: `No live checkout revision was provided for branch "${baseRevision.branch}"; freshness cannot be established.`,
            },
        ], unmeasurableLists);
    }
    if (input.receipt.revision === undefined) {
        return finalize('unmeasurable', 'none', [
            {
                code: 'no-mapping',
                message: `The receipt carries no revision stamp, so it cannot be compared with the live checkout "${live.revision}".`,
            },
        ], unmeasurableLists);
    }
    if (
        input.receipt.revision !== live.revision ||
        input.receipt.commit !== live.commit ||
        input.receipt.branch !== live.branch
    ) {
        return finalize('unmeasurable', 'none', [
            {
                code: 'stale-receipt',
                message:
                    `The receipt revision "${input.receipt.revision}" (branch "${input.receipt.branch}", ` +
                    `commit "${input.receipt.commit}") does not match the live checkout "${live.revision}" ` +
                    `(branch "${live.branch}", commit "${live.commit}").`,
            },
        ], unmeasurableLists);
    }

    const diagram = input.diagram;
    const nodeIdsInGraph = new Set<string>(
        diagram ? diagram.graph.nodes.map((node) => node.id) : [],
    );
    const pathsInGraph = new Set<string>(
        diagram ? diagram.graph.nodes.flatMap((node) => (typeof node.path === 'string' ? [node.path] : [])) : [],
    );

    const reasons: DeltaReason[] = [];

    const mapping = diagram !== null ? diagram.itemMappings[itemId] : undefined;

    if (mapping !== undefined && diagram !== null) {
        let evidenceKind: EvidenceKind;

        // Nöbetçi 5: makbuz eşlemesi grafa karşı doğrulanır; bozuk kimlik sessiz
        // yutulmaz, doğrudan patlar (fail-loud).
        const affectedNodeIds = uniqueSorted(mapping.nodeIds).slice(0, MAX_AFFECTED);
        for (const nodeId of affectedNodeIds) {
            if (!nodeIdsInGraph.has(nodeId)) {
                throw new TypeError(
                    `Mapping for item "${itemId}" references unknown graph node id "${nodeId}".`,
                );
            }
        }
        const affectedPaths = uniqueSorted(mapping.paths).slice(0, MAX_AFFECTED);
        const affectedTests = uniqueSorted(mapping.testPaths).slice(0, MAX_AFFECTED);

        // Nöbetçi 6: bildirilen ama ne eşlemede ne grafta olan yol → ÖNERİ düğüm;
        // kenarı uydurmak yerine 'edges-not-measurable-yet' diyeceğiz.
        const proposedNodes = declaredPaths
            .filter((path) => !mapping.paths.includes(path) && !pathsInGraph.has(path))
            .slice(0, MAX_PROPOSED_NODES)
            .map((path): ProposedNode => ({
                id: safeMermaidId(path),
                label: posixBasename(path),
                path,
            }))
            .sort((left, right) => compare(left.path, right.path));

        const measuredSurfaceExists = affectedNodeIds.length > 0 || affectedTests.length > 0;
        if (measuredSurfaceExists) {
            evidenceKind = 'receipt-mapping';
        } else if (declaredPaths.length > 0) {
            evidenceKind = 'declared-text-only';
            reasons.push({
                code: 'paths-not-measured',
                message: `The item mapping for "${itemId}" carries no measured node or test; the declared paths were not measured.`,
            });
        } else {
            evidenceKind = 'none';
            reasons.push({
                code: 'no-mapping',
                message: `The item mapping for "${itemId}" is empty and no path is declared.`,
            });
        }
        if (proposedNodes.length > 0) {
            reasons.push({
                code: 'edges-not-measurable-yet',
                message: `${proposedNodes.length} declared path(s) resolve to no measured node; proposed nodes carry no invented edges.`,
            });
        }

        // Nöbetçi 7: karşılaştırma yalnız açıkça verilmiş baseline ile yapılır.
        const addedEdges: EdgeRef[] = [];
        const removedEdges: EdgeRef[] = [];
        if (measuredSurfaceExists) {
            if (input.baselineDiagram != null) {
                const nodeFilter = new Set(affectedNodeIds);
                const current = incidentEdges(diagram.graph.edges, nodeFilter);
                const baseline = incidentEdges(input.baselineDiagram.graph.edges, nodeFilter);
                const diff = diffEdges(current, baseline);
                for (const edge of diff.added.slice(0, MAX_EDGES)) addedEdges.push({ ...edge });
                for (const edge of diff.removed.slice(0, MAX_EDGES)) removedEdges.push({ ...edge });
            } else {
                reasons.push({
                    code: 'comparison-baseline-unavailable',
                    message: 'No baseline diagram was provided; added/removed edges are not computed.',
                });
            }
        }

        return finalize(measuredSurfaceExists ? 'measured' : 'declared-only', evidenceKind, reasons, {
            declaredPaths,
            affectedNodeIds,
            affectedPaths,
            affectedTests,
            proposedNodes,
            addedEdges,
            removedEdges,
        });
    }

    // Eşleme yoksa bildirim salt metindir: ölçüm illüzyonu yaratılmaz.
    const evidenceKind: EvidenceKind = declaredPaths.length > 0 ? 'declared-text-only' : 'none';
    if (declaredPaths.length > 0) {
        reasons.push({
            code: 'paths-not-measured',
            message: `Declared paths have no receipt mapping; they have not been measured.`,
        });
    } else {
        reasons.push({
            code: 'no-mapping',
            message: `The receipt diagram carries no mapping for item "${itemId}".`,
        });
    }
    // Senaryo-2 nöbetçisi (2026-08-26): eşleme yoksa bile grafta karşılığı
    // bulunmayan BİLDİRİLEN yol için kesikli öneri düğümü üretilir; kenar
    // uydurma yasağı aynen geçerlidir.
    const proposedNodes: ProposedNode[] = declaredPaths
        .filter((path) => !pathsInGraph.has(path))
        .slice(0, MAX_PROPOSED_NODES)
        .map((path): ProposedNode => ({
            id: safeMermaidId(path),
            label: posixBasename(path),
            path,
        }))
        .sort((left, right) => compare(left.path, right.path));
    if (proposedNodes.length > 0) {
        reasons.push({
            code: 'edges-not-measurable-yet',
            message: `${proposedNodes.length} declared path(s) resolve to no measured node; proposed nodes carry no invented edges.`,
        });
    }
    return finalize('declared-only', evidenceKind, reasons, {
        declaredPaths,
        affectedNodeIds: [],
        affectedPaths: [],
        affectedTests: [],
        proposedNodes,
        addedEdges: [],
        removedEdges: [],
    });
}
