// Diyagram grafı sözleşmesi — Dilim 2.0, schemaVersion 1.
//
// gitdiagram `features/diagram/graph.ts` sözleşmesinin zod^3 uyarlaması:
// zod4 `strictObject` yoktur → her nesne `.strict()` ile kapatılır. Modül
// saftır: I/O yok, throw yok; sonuç `DiagramValidationResult` olarak döner.

import { z } from 'zod';

/** Graf büyüklük sınırları — referans motor sabitleriyle aynı. */
export const MAX_GRAPH_GROUPS = 10;
export const MAX_GRAPH_NODES = 34;
export const MAX_GRAPH_EDGES = 48;
export const MAX_GRAPH_LABEL_LENGTH = 72;
export const MAX_GRAPH_TYPE_LENGTH = 72;
export const MAX_GRAPH_DESCRIPTION_LENGTH = 240;
export const MAX_GRAPH_PATH_LENGTH = 512;

/** Düğüm/grup/kenar kimliği: küçük harf başlar; harf, rakam ve alt çizgi. */
const GRAPH_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

const graphIdSchema = z.string().trim().regex(GRAPH_ID_PATTERN);

/** Mermaid'e girecek metinler için ortak temizlik (referansla birebir). */
export function normalizeDiagramText(value: string): string {
    return value
        .normalize('NFC')
        .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
}

function renderableDiagramTextSchema(maxLength: number) {
    return z
        .string()
        .trim()
        .min(1)
        .max(maxLength)
        .refine((value) => normalizeDiagramText(value).length > 0, {
            message: 'Must contain visible text.',
        });
}

/** Düğüm şekli — referanstaki `shape` enum'u burada doğrudan `type` alanıdır. */
export const DiagramNodeShape = z.enum([
    'box',
    'database',
    'queue',
    'document',
    'circle',
    'hexagon',
]);
export type DiagramNodeShape = z.infer<typeof DiagramNodeShape>;

export const DiagramEdgeStyle = z.enum(['solid', 'dashed']);
export type DiagramEdgeStyle = z.infer<typeof DiagramEdgeStyle>;

export const DiagramGroup = z
    .object({
        id: graphIdSchema,
        label: renderableDiagramTextSchema(MAX_GRAPH_LABEL_LENGTH),
        description: z
            .string()
            .trim()
            .max(MAX_GRAPH_DESCRIPTION_LENGTH),
    })
    .strict();
export type DiagramGroup = z.infer<typeof DiagramGroup>;

export const DiagramGraphNode = z
    .object({
        id: graphIdSchema,
        label: renderableDiagramTextSchema(MAX_GRAPH_LABEL_LENGTH),
        type: DiagramNodeShape,
        groupId: graphIdSchema.optional(),
        path: z
            .string()
            .trim()
            .min(1)
            .max(MAX_GRAPH_PATH_LENGTH)
            .optional(),
        description: z
            .string()
            .trim()
            .max(MAX_GRAPH_DESCRIPTION_LENGTH)
            .optional(),
    })
    .strict();
export type DiagramGraphNode = z.infer<typeof DiagramGraphNode>;

export const DiagramGraphEdge = z
    .object({
        from: graphIdSchema,
        to: graphIdSchema,
        label: renderableDiagramTextSchema(MAX_GRAPH_LABEL_LENGTH).optional(),
        style: DiagramEdgeStyle.optional(),
    })
    .strict();
export type DiagramGraphEdge = z.infer<typeof DiagramGraphEdge>;

export const DiagramGraphMetadata = z
    .object({
        projectId: z.string().min(1),
        branch: z.string().min(1),
        commit: z.string().min(1),
        revisionKind: z.enum(['commit', 'working-tree']).optional(),
        revision: z.string().min(1).optional(),
        generatedAt: z.string().datetime(),
    })
    .strict();
export type DiagramGraphMetadata = z.infer<typeof DiagramGraphMetadata>;

/**
 * Saf diyagram grafı. D5.2: şema sürümlüdür — tüketici uyumsuz veriyi reddeder.
 * `metadata`, grafiği üreten indeks koşumunu geri izlenebilir kılar.
 */
export const diagramGraphSchema = z
    .object({
        schemaVersion: z.literal(1),
        metadata: DiagramGraphMetadata,
        groups: z.array(DiagramGroup).max(MAX_GRAPH_GROUPS),
        nodes: z.array(DiagramGraphNode).min(1).max(MAX_GRAPH_NODES),
        edges: z.array(DiagramGraphEdge).max(MAX_GRAPH_EDGES),
    })
    .strict();
export type DiagramGraph = z.infer<typeof diagramGraphSchema>;

/**
 * Doğrulama kategorileri — makine sözleşmesi (DESIGN D1): İngilizce sabittir.
 * Referanstaki `invalid_json` kapsam dışıdır: bu modül ham JSON değil,
 * ayrıştırılmış `unknown` alır; JSON çözümleme çağıranın işidir.
 */
export type GraphIssueCategory =
    | 'schema_validation'
    | 'duplicate_group_id'
    | 'duplicate_node_id'
    | 'unknown_group_id'
    | 'missing_repository_path'
    | 'unknown_edge_source'
    | 'unknown_edge_target';

export interface GraphIssue {
    category: GraphIssueCategory;
    path: string;
    message: string;
}

export interface DiagramValidationResult {
    valid: boolean;
    issues: GraphIssue[];
    /** Yalnız valid:true iken doludur — şemadan geçmiş kanonik graf. */
    graph?: DiagramGraph;
}

/**
 * Grafı şema + tutarlılık kurallarına göre doğrular. I/O yapmaz, fırlatmaz;
 * bütün bulgular `issues` içinde İngilizce kategori adlarıyla döner.
 */
export function validateDiagramGraph(input: unknown): DiagramValidationResult {
    const parsed = diagramGraphSchema.safeParse(input);
    if (!parsed.success) {
        return {
            valid: false,
            issues: parsed.error.issues.map((issue) => ({
                category: 'schema_validation' as const,
                path: issue.path.join('.') || 'graph',
                message: issue.message,
            })),
        };
    }

    const graph = parsed.data;
    const issues: GraphIssue[] = [];
    const groupIds = new Set<string>();
    const nodeIds = new Set<string>();

    graph.groups.forEach((group, index) => {
        if (groupIds.has(group.id)) {
            issues.push({
                category: 'duplicate_group_id',
                path: `groups.${index}.id`,
                message: `Duplicate group id "${group.id}".`,
            });
        }
        groupIds.add(group.id);
    });

    graph.nodes.forEach((node, index) => {
        if (nodeIds.has(node.id)) {
            issues.push({
                category: 'duplicate_node_id',
                path: `nodes.${index}.id`,
                message: `Duplicate node id "${node.id}".`,
            });
        }
        nodeIds.add(node.id);

        if (node.groupId !== undefined && !groupIds.has(node.groupId)) {
            issues.push({
                category: 'unknown_group_id',
                path: `nodes.${index}.groupId`,
                message: `Unknown group id "${node.groupId}" for node "${node.id}".`,
            });
        }

        // Bu modül dosya ağacını görmez: repository bağlantısı için path zorunludur.
        if (!node.path || node.path.trim().length === 0) {
            issues.push({
                category: 'missing_repository_path',
                path: `nodes.${index}.path`,
                message: `Node "${node.id}" has no repository path.`,
            });
        }
    });

    graph.edges.forEach((edge, index) => {
        if (!nodeIds.has(edge.from)) {
            issues.push({
                category: 'unknown_edge_source',
                path: `edges.${index}.from`,
                message: `Unknown source node id "${edge.from}".`,
            });
        }
        if (!nodeIds.has(edge.to)) {
            issues.push({
                category: 'unknown_edge_target',
                path: `edges.${index}.to`,
                message: `Unknown target node id "${edge.to}".`,
            });
        }
    });

    return { valid: issues.length === 0, issues, graph: parsed.data };
}
