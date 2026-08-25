// Saf diyagram derleyicisi — Dilim 2.0, adım 2 (PLAN.md).
//
// DiagramGraph → deterministik Mermaid. Referans: gitdiagram
// `server/generate/graph.ts` compileDiagramGraph (subgraph/classDef katmanı
// hariç: sanitizer'ımız bu yönergeleri enjeksiyon sinyali olarak reddeder;
// grup bilgisi sözleşmede yaşar, UI tarafında kullanılır — dürüst sapma).
//
// Saflık sözleşmesi: I/O yok, ağ yok, model çağrısı yok, global durum yok.
// Aynı girdi her koşumda aynı çıktıyı üretir (düğümler ve kenarlar kanonik
// sıraya alınır). Geçersiz graf "başarılı" görünmez: sorun listesiyle döner.

import {
    validateDiagramGraph,
    type DiagramGraphEdge,
    type DiagramGraphNode,
    type GraphIssue,
} from './graph-schema';
import {
    buildFileLink,
    escapeMermaidLabel,
    validateMermaidSource,
} from './mermaid-sanitize';

export interface DiagramCompileOptions {
    /** Düğüm kaynağına giden temel adres (örn. https://github.com/owner/repo). */
    fileLinkBase?: string;
    /** Kaynak bağlantısının dalı — fileLinkBase ile birlikte zorunludur. */
    branch?: string;
}

export type DiagramCompileFailureReason =
    | 'invalid_graph'
    | 'invalid_repository_path'
    | 'unsafe_output';

export type DiagramCompileResult =
    | { ok: true; mermaid: string }
    | { ok: false; reason: DiagramCompileFailureReason; issues: GraphIssue[] };

/** Depo yolu güvenli mi? Mutlak yol, sürücü harfi ve `..` gezinimi reddedilir. */
function repositoryPathProblem(path: string): boolean {
    if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return true;
    return path.split('/').some((segment) => segment === '..');
}

/**
 * Düğüm satırı — referans motorla aynı şekil eşlemesi:
 * database `[("…")]` · circle `((…"…))` · hexagon `{{"…"}}` · diğerleri `["…"]`.
 */
function renderNodeLine(node: DiagramGraphNode): string {
    const id = `node_${node.id}`;
    const label = `"${escapeMermaidLabel(node.label)}"`;
    switch (node.type) {
        case 'database':
            return `${id}[(${label})]`;
        case 'circle':
            return `${id}((${label}))`;
        case 'hexagon':
            return `${id}{{${label}}}`;
        default:
            return `${id}[${label}]`;
    }
}

function renderEdgeLine(edge: DiagramGraphEdge): string {
    const connector = edge.style === 'dashed' ? '-.->' : '-->';
    const from = `node_${edge.from}`;
    const to = `node_${edge.to}`;
    if (!edge.label) return `${from} ${connector} ${to}`;
    return `${from} ${connector}|"${escapeMermaidLabel(edge.label)}"| ${to}`;
}

function compareStrings(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function compareNodes(left: DiagramGraphNode, right: DiagramGraphNode): number {
    return compareStrings(left.id, right.id);
}

function compareEdges(left: DiagramGraphEdge, right: DiagramGraphEdge): number {
    return (
        compareStrings(left.from, right.from) ||
        compareStrings(left.to, right.to) ||
        compareStrings(left.label ?? '', right.label ?? '') ||
        compareStrings(left.style ?? '', right.style ?? '')
    );
}

function failure(
    reason: 'invalid_repository_path' | 'unsafe_output',
    issue: GraphIssue,
): DiagramCompileResult {
    return { ok: false, reason, issues: [issue] };
}

/**
 * Grafi doğrular ve geçerliyse deterministik Mermaid akış çizelgesi üretir.
 * Geçersiz girdide hiçbir kenar/düğüm uydurmaz; `ok:false` + sorun listesi
 * döner. Üretilen kaynak son bir yapısal güvenlik denetiminden geçirilir.
 */
export function compileDiagramMermaid(
    graphInput: unknown,
    options: DiagramCompileOptions = {},
): DiagramCompileResult {
    const validation = validateDiagramGraph(graphInput);
    if (!validation.valid || !validation.graph) {
        return { ok: false, reason: 'invalid_graph', issues: validation.issues };
    }
    const graph = validation.graph;

    for (const node of graph.nodes) {
        if (!node.path || repositoryPathProblem(node.path)) {
            return failure('invalid_repository_path', {
                category: 'missing_repository_path',
                path: `nodes.${node.id}.path`,
                message: `Node "${node.id}" has an unusable repository path.`,
            });
        }
    }

    const lines: string[] = ['flowchart TD'];
    const sortedNodes = [...graph.nodes].sort(compareNodes);
    for (const node of sortedNodes) {
        lines.push(renderNodeLine(node));
    }

    const sortedEdges = [...graph.edges].sort(compareEdges);
    for (const edge of sortedEdges) {
        lines.push(renderEdgeLine(edge));
    }

    const fileLinkBase = options.fileLinkBase;
    const branch = options.branch;
    if (fileLinkBase !== undefined && branch !== undefined) {
        for (const node of sortedNodes) {
            if (!node.path) continue;
            try {
                const link = buildFileLink(fileLinkBase, branch, node.path);
                lines.push(`click node_${node.id} "${link}"`);
            } catch (error) {
                return failure('invalid_repository_path', {
                    category: 'missing_repository_path',
                    path: `nodes.${node.id}.path`,
                    message:
                        `Source link for node "${node.id}" could not be built safely: ` +
                        (error instanceof Error ? error.message : String(error)),
                });
            }
        }
    }

    const mermaid = lines.join('\n');
    const safety = validateMermaidSource(mermaid);
    if (!safety.ok) {
        return failure('unsafe_output', {
            category: 'schema_validation',
            path: 'mermaid',
            message: `Compiled output failed structural validation: ${safety.reason ?? 'unknown'}.`,
        });
    }
    return { ok: true, mermaid };
}
