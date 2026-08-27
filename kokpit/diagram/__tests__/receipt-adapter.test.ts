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
        expect(receipt.graph.groups.map((group) => group.id)).toEqual([
            'runtime',
            'analysis',
            'integration',
        ]);
        expect(receipt.graph.nodes.every((node) => Boolean(node.groupId))).toBe(true);
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

    it('plan bağlantısı olmayan taranmış düğümler measured-import olarak kalır', () => {
        const receipt = buildReceiptDiagram({ ...BASE_INPUT, scan: fakeScan(), groups: [] });
        for (const evidence of Object.values(receipt.nodeEvidence)) {
            expect(evidence.evidenceKind).toBe('measured-import');
        }
    });

    it('ölçülmüş kenarlara yalnız doğrulanabilir import dili ve dinamik/tip stili ekler', () => {
        const receipt = buildReceiptDiagram({ ...BASE_INPUT, scan: fakeScan(), groups: [] });
        const crossGroup = receipt.graph.edges.find((edge) => edge.from !== edge.to && edge.label === 'imports');
        expect(crossGroup).toBeDefined();
        const typeImport = receipt.graph.edges.find((edge) => edge.label === 'type import');
        expect(typeImport).toMatchObject({ style: 'dashed' });
        expect(receipt.graph.edges.every((edge) => !edge.label || ['imports', 'type import', 'dynamic import'].includes(edge.label))).toBe(true);
    });

    it('test/fixture dosyalarını mimari düğüm yapmaz; doğrudan test importunu madde kanıtına bağlar', () => {
        const scan = fakeScan({
            nodes: [
                { path: 'src/service.ts' },
                { path: 'src/service.test.ts' },
                { path: 'src/__fixtures__/sample.ts' },
            ],
            edges: [
                { from: 'src/service.test.ts', to: 'src/service.ts', resolved: true, dynamic: false, typeOnly: false },
            ],
            scannedFileCount: 3,
            unresolvedCount: 0,
        });
        const groups: PhaseGroup[] = [{
            heading: 'Dilim 2',
            items: [{ id: 'madde-1', title: 'src/service.ts üretim servisi', status: 'partial', phaseHeading: 'Dilim 2', line: 3 }],
        }];
        const receipt = buildReceiptDiagram({ ...BASE_INPUT, scan, groups });
        expect(receipt.graph.nodes.map((node) => node.path)).toEqual(['src/service.ts']);
        const mapping = receipt.itemMappings['Dilim 2::madde-1'];
        expect(mapping?.paths).toEqual(['src/service.ts']);
        expect(mapping?.testPaths).toEqual(['src/service.test.ts']);
    });

    it('test yoğunluğunu üretim mimarisi merkeziliği gibi sıralamaz', () => {
        const production = Array.from({ length: 35 }, (_, index) => ({ path: `src/${String(index).padStart(2, '0')}.ts` }));
        const tests = Array.from({ length: 8 }, (_, index) => ({ path: `tests/z-${index}.test.ts` }));
        const scan = fakeScan({
            nodes: [...production, ...tests],
            edges: tests.map((test) => ({ from: test.path, to: 'src/34.ts', resolved: true, dynamic: false, typeOnly: false })),
            scannedFileCount: production.length + tests.length,
            unresolvedCount: 0,
        });
        const receipt = buildReceiptDiagram({ ...BASE_INPUT, scan, groups: [] });
        expect(receipt.graph.nodes.map((node) => node.path)).not.toContain('src/34.ts');
        expect(receipt.graph.nodes.some((node) => node.path?.includes('.test.'))).toBe(false);
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
