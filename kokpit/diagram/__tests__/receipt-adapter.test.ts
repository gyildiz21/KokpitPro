import { describe, expect, it } from 'vitest';
import type { PhaseGroup } from '../../parser/schema';
import type { ImportScanResult } from '../../importgraph/scan';
import { buildReceiptDiagram } from '../receipt-adapter';

function fakeScan(overrides: Partial<ImportScanResult> = {}): ImportScanResult {
    const nodes = [
        { path: 'kokpit/server.ts' },
        { path: 'kokpit/parser/index.ts' },
        { path: 'kokpit/parser/roadmap.ts' },
        { path: 'kokpit/projects/schema.ts' },
        { path: 'kokpit/diagram/compile.ts' },
    ];
    const edges = [
        { from: 'kokpit/server.ts', to: 'kokpit/parser/index.ts', resolved: true, dynamic: false, typeOnly: false },
        { from: 'kokpit/server.ts', to: 'kokpit/parser/roadmap.ts', resolved: true, dynamic: false, typeOnly: false },
        { from: 'kokpit/parser/index.ts', to: 'kokpit/parser/roadmap.ts', resolved: true, dynamic: false, typeOnly: true },
        { from: 'kokpit/projects/schema.ts', to: 'kokpit/parser/schema.ts', resolved: false, dynamic: false, typeOnly: false, raw: './parser/schema' },
    ];
    return {
        scannedFileCount: nodes.length,
        nodes,
        edges,
        unresolvedCount: 1,
        durationMs: 12.5,
        ...overrides,
    };
}

const GROUPS: PhaseGroup[] = [
    {
        heading: 'Dilim 2.0 · Saf diyagram motoru',
        items: [
            { id: 'madde-1', title: '`kokpit/parser/roadmap.ts` checkbox ayrıştırıcı', status: 'done', phaseHeading: 'x', line: 3 },
            { id: 'madde-2', title: '`kokpit/diagram/compile.ts` deterministik derleyici', status: 'partial', phaseHeading: 'x', line: 5 },
        ],
    },
    {
        heading: 'Dilim 3 · Delta',
        items: [
            { id: 'madde-1', title: 'Yok olmayan yola bağlanan madde docs/hayal.md', status: 'open', phaseHeading: 'y', line: 9 },
        ],
    },
];

const BASE_INPUT = {
    projectId: 'local-kokpitpro',
    branch: 'codex/dilim-2-real-map',
    commit: '8821a1e36da3d164137f36e43978c7a01fd06bd1',
    generatedAt: '2026-08-25T12:00:00.000Z',
};

describe('buildReceiptDiagram makbuz ve kanıt hiyerarşisi', () => {
    it('gerçek taramadan graf üretir; ölçüm sayıları dürüstçe raporlanır', () => {
        const receipt = buildReceiptDiagram({ ...BASE_INPUT, scan: fakeScan(), groups: [] });
        expect(receipt.graph.schemaVersion).toBe(1);
        expect(receipt.measurements.scannedFileCount).toBe(5);
        expect(receipt.measurements.totalEdgeCount).toBe(4);
        expect(receipt.measurements.unresolvedCount).toBe(1);
        expect(receipt.graph.nodes.length).toBe(receipt.measurements.renderedNodeCount);
    });

    it('her düğüm projectId/dal/commit makbuzunu taşır — başka proje sızmaz', () => {
        const receipt = buildReceiptDiagram({ ...BASE_INPUT, scan: fakeScan(), groups: [] });
        for (const node of receipt.graph.nodes) {
            const evidence = receipt.nodeEvidence[node.id];
            expect(evidence).toBeDefined();
            if (!evidence) return;
            expect(evidence.projectId).toBe('local-kokpitpro');
            expect(evidence.branch).toBe('codex/dilim-2-real-map');
            expect(evidence.commit).toBe('8821a1e36da3d164137f36e43978c7a01fd06bd1');
            expect(evidence.path).toBe(node.path);
        }
        const otherProject = JSON.stringify(Object.values(receipt.nodeEvidence)).includes('method-logos');
        expect(otherProject).toBe(false);
    });

    it('path eşleşen plan maddesi kanıt türünü plan-path-match yapar; status plan bilgisi olarak taşınır', () => {
        const receipt = buildReceiptDiagram({ ...BASE_INPUT, scan: fakeScan(), groups: GROUPS });
        const roadmapId = receipt.graph.nodes.find((node) => node.path === 'kokpit/parser/roadmap.ts')?.id;
        expect(roadmapId).toBeDefined();
        if (!roadmapId) return;
        const evidence = receipt.nodeEvidence[roadmapId];
        expect(evidence).toBeDefined();
        if (!evidence) return;
        expect(evidence.evidenceKind).toBe('plan-path-match');
        expect(evidence.itemStatus).toBe('done');
        expect(evidence.phaseHeading).toContain('Dilim 2.0');
        // Bileşik faz kimliği: (phaseHeading, item.id)
        expect(evidence.itemId).toBe('Dilim 2.0 · Saf diyagram motoru::madde-1');
    });

    it('checkbox [x] tek başına measured-import KANITI ÜRETMEZ (sahte kapı nöbetçisi)', () => {
        const onlyPlanScan = fakeScan({
            nodes: [{ path: 'docs/hayal.md' }],
            edges: [],
            unresolvedCount: 0,
        });
        const receipt = buildReceiptDiagram({
            ...BASE_INPUT,
            scan: onlyPlanScan,
            groups: [
                {
                    heading: 'H',
                    items: [
                        { id: 'm-1', title: 'docs/hayal.md tamamlandı', status: 'done', phaseHeading: 'H', line: 1 },
                    ],
                },
            ],
        });
        const node = receipt.graph.nodes[0];
        expect(node?.label).toBe('hayal.md');
        if (!node) return;
        const evidence = receipt.nodeEvidence[node.id];
        expect(evidence).toBeDefined();
        if (!evidence) return;
        expect(evidence.evidenceKind).not.toBe('measured-import');
    });

    it('eşleşmeyen plan maddeleri görünür kalır; tahmin üretilmez', () => {
        const receipt = buildReceiptDiagram({ ...BASE_INPUT, scan: fakeScan(), groups: GROUPS });
        const unmatched = receipt.unmatchedPlanItems.find((item) => item.phaseHeading.includes('Delta'));
        expect(unmatched).toBeDefined();
        expect(unmatched?.mentionedPath).toBe('docs/hayal.md');
    });

    it('plan bağlantısı olmayan düğümler unmeasured kalır', () => {
        const receipt = buildReceiptDiagram({ ...BASE_INPUT, scan: fakeScan(), groups: [] });
        for (const evidence of Object.values(receipt.nodeEvidence)) {
            expect(evidence.evidenceKind).toBe('unmeasured');
        }
    });

    it('aynı girdi deterministik graf üretir (durationMs hariç alan)', () => {
        const left = buildReceiptDiagram({ ...BASE_INPUT, scan: fakeScan(), groups: GROUPS });
        const right = buildReceiptDiagram({ ...BASE_INPUT, scan: fakeScan(), groups: GROUPS });
        expect(left.graph).toEqual(right.graph);
        expect(left.nodeEvidence).toEqual(right.nodeEvidence);
        expect(left.unmatchedPlanItems).toEqual(right.unmatchedPlanItems);
    });

    it('34 düğüm üstü taramada kırpma ölçümle raporlanır; kenarlar yalnız seçili düğümler arasında kurulur', () => {
        const many = Array.from({ length: 40 }, (_, index) => ({ path: `src/mod${String(index).padStart(2, '0')}.ts` }));
        const bigEdges = many.slice(1).map((node) => ({
            from: many[0]!.path,
            to: node.path,
            resolved: true,
            dynamic: false,
            typeOnly: false,
        }));
        const receipt = buildReceiptDiagram({
            ...BASE_INPUT,
            scan: fakeScan({ nodes: many, edges: bigEdges, scannedFileCount: many.length }),
            groups: [],
        });
        expect(receipt.graph.nodes.length).toBeLessThanOrEqual(34);
        expect(receipt.measurements.scannedFileCount).toBe(40);
        expect(receipt.measurements.renderedNodeCount).toBe(34);
        for (const edge of receipt.graph.edges) {
            expect(receipt.graph.nodes.some((node) => node.id === edge.from)).toBe(true);
            expect(receipt.graph.nodes.some((node) => node.id === edge.to)).toBe(true);
        }
    });
});
