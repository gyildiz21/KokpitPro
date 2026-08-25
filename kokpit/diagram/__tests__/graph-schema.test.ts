// Dilim 2.0 nöbetçileri: DiagramGraph sözleşmesi (zod^3 strict uyumu).

import { describe, expect, it } from 'vitest';
import {
    diagramGraphSchema,
    normalizeDiagramText,
    validateDiagramGraph,
    type DiagramGraph,
} from '../graph-schema';

const METADATA = {
    projectId: 'kokpit-pro',
    branch: 'codex/dilim-2-real-map',
    commit: 'abc1234',
    generatedAt: '2026-08-25T12:00:00.000Z',
};

function validGraph(): DiagramGraph {
    return {
        schemaVersion: 1,
        metadata: METADATA,
        groups: [{ id: 'parser', label: 'Parser', description: 'Faz ayrıştırıcı katmanı' }],
        nodes: [
            {
                id: 'roadmap_parser',
                label: 'Roadmap Parser',
                type: 'box',
                groupId: 'parser',
                path: 'kokpit/parser/roadmap.ts',
            },
        ],
        edges: [],
    };
}

function categoriesOf(input: unknown) {
    const result = validateDiagramGraph(input);
    return result.issues.map((issue) => issue.category);
}

describe('diagramGraphSchema — geçerli graf', () => {
    it('minimal geçerli graf parse ve validate aşamalarını geçirir', () => {
        const graph = validGraph();
        const parsed = diagramGraphSchema.safeParse(graph);
        expect(parsed.success).toBe(true);

        const result = validateDiagramGraph(graph);
        expect(result.valid).toBe(true);
        expect(result.issues).toEqual([]);
    });
});

describe('diagramGraphSchema — şema reddi', () => {
    it('kötü düğüm kimliği reddedilir (büyük harf / boşluk)', () => {
        const bad = validGraph();
        bad.nodes[0]!.id = 'Roadmap Parser';
        const parsed = diagramGraphSchema.safeParse(bad);
        expect(parsed.success).toBe(false);

        const result = validateDiagramGraph(bad);
        expect(result.valid).toBe(false);
        expect(categoriesOf(bad)).toEqual(['schema_validation']);
    });

    it('boş etiket reddedilir', () => {
        for (const label of ['', '   ']) {
            const bad = validGraph();
            bad.nodes[0]!.label = label;
            const result = validateDiagramGraph(bad);
            expect(result.valid).toBe(false);
            expect(result.issues[0]?.category).toBe('schema_validation');
        }
    });

    it('bilinmeyen alan eklenince strict şema reddeder (zod davranışı)', () => {
        const bad = validGraph() as Record<string, unknown>;
        const nodes = bad.nodes as Array<Record<string, unknown>>;
        nodes[0]!['tone'] = 'blue';
        const parsed = diagramGraphSchema.safeParse(bad);
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(parsed.error.issues[0]?.message).toContain('Unrecognized key');
        }
        expect(validateDiagramGraph(bad).valid).toBe(false);
    });

    it('schemaVersion 2 reddedilir — tüketici sürümü doğrular', () => {
        const bad = { ...validGraph(), schemaVersion: 2 };
        const parsed = diagramGraphSchema.safeParse(bad);
        expect(parsed.success).toBe(false);
        expect(validateDiagramGraph(bad).valid).toBe(false);
    });
});

describe('validateDiagramGraph — tutarlılık kuralları', () => {
    it('yinelenen node id ve group id issue üretir', () => {
        const dup = validGraph();
        dup.groups.push({ id: 'parser', label: 'Parser Kopya', description: '' });
        dup.nodes.push({
            id: 'roadmap_parser',
            label: 'Roadmap Parser Kopya',
            type: 'box',
            path: 'kokpit/parser/roadmap.ts',
        });

        const result = validateDiagramGraph(dup);
        expect(result.valid).toBe(false);
        const cats = categoriesOf(dup);
        expect(cats).toContain('duplicate_group_id');
        expect(cats).toContain('duplicate_node_id');

        const nodeIssue = result.issues.find((i) => i.category === 'duplicate_node_id');
        expect(nodeIssue?.path).toBe('nodes.1.id');
        const groupIssue = result.issues.find((i) => i.category === 'duplicate_group_id');
        expect(groupIssue?.path).toBe('groups.1.id');
    });

    it('node.groupId bilinmeyen gruba işaret ediyorsa unknown_group_id üretir', () => {
        const orphan = validGraph();
        orphan.nodes[0]!.groupId = 'yok_boyle_grup';
        const result = validateDiagramGraph(orphan);
        expect(result.valid).toBe(false);
        expect(categoriesOf(orphan)).toContain('unknown_group_id');
    });

    it("path'siz düğüm missing_repository_path üretir", () => {
        const noPath = validGraph();
        delete noPath.nodes[0]!.path;
        const result = validateDiagramGraph(noPath);
        expect(result.valid).toBe(false);

        const issue = result.issues.find((i) => i.category === 'missing_repository_path');
        expect(issue?.path).toBe('nodes.0.path');
    });

    it('kenar ucu bilinmeyen düğüme gidiyorsa unknown_edge_source/target üretir', () => {
        const badEdges = validGraph();
        badEdges.edges.push(
            { from: 'hayali_kaynak', to: 'roadmap_parser' },
            { from: 'roadmap_parser', to: 'hayali_hedef' },
        );
        const result = validateDiagramGraph(badEdges);
        expect(result.valid).toBe(false);
        expect(categoriesOf(badEdges)).toContain('unknown_edge_source');
        expect(categoriesOf(badEdges)).toContain('unknown_edge_target');
    });
});

describe('normalizeDiagramText', () => {
    it('kontrol karakterlerini boşluğa çevirip tekilleştirir', () => {
        expect(normalizeDiagramText('a\u0000b\u001f\u001f c\td\n\u2028e')).toBe('a b c d e');
        expect(normalizeDiagramText('   x  y ')).toBe('x y');
    });

    it('NFC ile bileşik karakterleri birleştirir', () => {
        expect(normalizeDiagramText('e\u0301')).toBe('\u00e9');
    });
});
