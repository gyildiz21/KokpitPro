import { describe, expect, it } from 'vitest';
import { compileDiagramMermaid } from '../compile';
import { diagramGraphSchema, type DiagramGraph, type DiagramGraphNode } from '../graph-schema';
import { validateMermaidSource } from '../mermaid-sanitize';

const METADATA = {
    projectId: 'kokpit-pro',
    branch: 'main',
    commit: '8821a1e36da3d164137f36e43978c7a01fd06bd1',
    generatedAt: '2026-08-25T12:00:00.000Z',
};

function baseGraph(): DiagramGraph {
    return {
        schemaVersion: 1,
        metadata: METADATA,
        groups: [],
        nodes: [
            { id: 'server', label: 'server.ts', type: 'hexagon', path: 'kokpit/server.ts' },
            { id: 'parser', label: 'parser/index', type: 'box', path: 'kokpit/parser/index.ts' },
        ],
        edges: [{ from: 'server', to: 'parser', style: 'solid' }],
    };
}

/** noUncheckedIndexedAccess-dostu düğüm yaması. */
function patchedGraph(index: number, patch: Partial<DiagramGraphNode>, source: DiagramGraph = baseGraph()): DiagramGraph {
    const current = source.nodes[index];
    if (!current) throw new Error(`fixture node missing at ${index}`);
    const nodes = [...source.nodes];
    nodes[index] = { ...current, ...patch };
    return { ...source, nodes };
}

describe('compileDiagramMermaid determinizm ve sözleşme', () => {
    it('geçerli grafi akış çizelgesine çevirir; aynı girdi her koşumda aynı çıktıyı üretir', () => {
        const first = compileDiagramMermaid(baseGraph());
        const second = compileDiagramMermaid(baseGraph());
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        expect(second).toEqual(first);
        expect(first.mermaid.startsWith('flowchart TD\n')).toBe(true);
        expect(validateMermaidSource(first.mermaid).ok).toBe(true);
    });

    it('düğüm sırası karışmış girdide kanonik (aynı) çıktı üretir', () => {
        const shuffled = baseGraph();
        const reordered = { ...shuffled, nodes: [...shuffled.nodes].reverse() };
        expect(compileDiagramMermaid(reordered)).toEqual(compileDiagramMermaid(shuffled));
    });

    it('şekil eşlemesi referans motorla aynıdır', () => {
        const graph = baseGraph();
        graph.nodes = [
            { id: 'db', label: 'registry.json', type: 'database', path: 'x.json' },
            { id: 'ring', label: 'loop', type: 'circle', path: 'y.ts' },
            { id: 'hex', label: 'server', type: 'hexagon', path: 'z.ts' },
            { id: 'plain', label: 'util', type: 'box', path: 'w.ts' },
            { id: 'q', label: 'queue', type: 'queue', path: 'q.ts' },
            { id: 'doc', label: 'doc', type: 'document', path: 'd.ts' },
        ];
        graph.edges = [];
        const result = compileDiagramMermaid(graph);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.mermaid).toContain('node_db[("registry.json")]');
        expect(result.mermaid).toContain('node_ring(("loop"))');
        expect(result.mermaid).toContain('node_hex{{"server"}}');
        expect(result.mermaid).toContain('node_plain["util"]');
        expect(result.mermaid).toContain('node_q["queue"]');
        expect(result.mermaid).toContain('node_doc["doc"]');
    });

    it('kesikli kenar ve etiketli kenarı referans sözdizimiyle basar', () => {
        const graph = baseGraph();
        graph.edges = [
            { from: 'server', to: 'parser', style: 'dashed' },
            { from: 'parser', to: 'server', style: 'solid', label: 'import eder' },
        ];
        const result = compileDiagramMermaid(graph);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.mermaid).toContain('node_server -.-> node_parser');
        expect(result.mermaid).toContain('|"import eder"|');
    });
});

describe('compileDiagramMermaid enjeksiyon ve özel karakter', () => {
    it('etikete gömülü yönerge enjeksiyonu komuta dönüşmez; çıktı yapısal denetimden geçer', () => {
        const graph = patchedGraph(0, {
            label: '" ; click evil "http://evil.example/p""',
            id: 'server',
            type: 'hexagon',
            path: 'kokpit/server.ts',
        });
        const result = compileDiagramMermaid(graph);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const clickLines = result.mermaid.split('\n').filter((line) => line.startsWith('click '));
        expect(clickLines).toEqual([]);
        expect(result.mermaid).toContain('#59;');
        expect(result.mermaid).toContain('#quot;');
        expect(validateMermaidSource(result.mermaid).ok).toBe(true);
    });

    it('HTML benzeri içerik varlık koduna iner', () => {
        const graph = patchedGraph(0, { label: '<img src=x onerror=alert(1)>' });
        const result = compileDiagramMermaid(graph);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.mermaid).not.toContain('<img');
        expect(result.mermaid).toContain('#60;');
    });

    it('sınır üstü uzun etiket şema katmanında dürüstçe reddedilir; sınır içi güvenle derlenir', () => {
        const rejected = compileDiagramMermaid(patchedGraph(0, { label: 'a'.repeat(300) }));
        expect(rejected.ok).toBe(false);
        if (!rejected.ok) expect(rejected.reason).toBe('invalid_graph');

        const accepted = compileDiagramMermaid(patchedGraph(0, { label: 'b'.repeat(72) }));
        expect(accepted.ok).toBe(true);
        if (accepted.ok) expect(validateMermaidSource(accepted.mermaid).ok).toBe(true);
    });

    it('Türkçe Unicode etiket korunur', () => {
        const graph = patchedGraph(0, { label: 'Faz İncelemesi — ğüşı' });
        const result = compileDiagramMermaid(graph);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.mermaid).toContain('Faz İncelemesi — ğüşı');
    });
});

describe('compileDiagramMermaid dürüst hata durumları', () => {
    it('boş düğüm listesi başarılı görünmez (invalid_graph)', () => {
        const graph = { ...baseGraph(), nodes: [] };
        const result = compileDiagramMermaid(graph);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('invalid_graph');
        expect(result.issues.length).toBeGreaterThan(0);
    });

    it('bilinmeyen kenar ucu uydurulmaz (unknown_edge_target)', () => {
        const graph = baseGraph();
        graph.edges = [{ from: 'server', to: 'hayali_dugum' }];
        const result = compileDiagramMermaid(graph);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('invalid_graph');
        expect(result.issues.some((issue) => issue.category === 'unknown_edge_target')).toBe(true);
    });

    it('bilinmeyen alan şemayı kırmalı (strict)', () => {
        const result = compileDiagramMermaid({ ...baseGraph(), surpriseField: true });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('invalid_graph');
    });

    it('path gezinimi içeren düğüm invalid_repository_path ile reddedilir', () => {
        const graph = patchedGraph(1, { path: '../../etc/passwd' });
        const result = compileDiagramMermaid(graph);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('invalid_repository_path');
    });

    it('fileLinkBase + branch verildiğinde güvenli click satırı üretilir; verilmezse üretilmez', () => {
        const withLinks = compileDiagramMermaid(baseGraph(), {
            fileLinkBase: 'https://github.com/example/kokpit-pro',
            branch: 'codex/dilim-2-real-map',
        });
        expect(withLinks.ok).toBe(true);
        if (withLinks.ok) {
            expect(withLinks.mermaid).toContain(
                'click node_parser "https://github.com/example/kokpit-pro/blob/codex/dilim-2-real-map/kokpit/parser/index.ts"',
            );
            const clickLines = withLinks.mermaid.split('\n').filter((line) => line.startsWith('click '));
            expect(clickLines).toHaveLength(2);
        }
        const withoutLinks = compileDiagramMermaid(baseGraph());
        expect(withoutLinks.ok).toBe(true);
        if (withoutLinks.ok) {
            expect(withoutLinks.mermaid).not.toContain('click ');
        }
    });

    it('şemadan geçen graf validateDiagramGraph.graph alanını taşır', () => {
        const parsed = diagramGraphSchema.safeParse(baseGraph());
        expect(parsed.success).toBe(true);
    });
});
