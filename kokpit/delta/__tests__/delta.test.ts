// Delta nöbetçi testleri — Dilim 3 · Delta.
//
// computeDelta'ın donmuş sözleşmesini sabitler: dürüst kanıt hiyerarşisi,
// bayatlık kapıları, kenar uydurma yasağı ve determinizm.

import { describe, expect, it } from 'vitest';
import { computeDelta, type DeltaComputeInput } from '../compute';
import { DeltaResult } from '../schema';
import type { ReceiptDiagram } from '../../diagram/receipt-adapter';
import type { PhaseGroup, PhaseItem } from '../../parser/schema';
import { safeMermaidId } from '../../diagram/mermaid-sanitize';

const PHASE_HEADING = 'Dilim 3 · Delta motoru';
const ITEM_KEY = 'madde-1';
const ITEM_ID = `${PHASE_HEADING}::${ITEM_KEY}`;
const ID_SERVER = safeMermaidId('kokpit/server.ts');
const ID_INDEX = safeMermaidId('kokpit/parser/index.ts');
const ID_ROADMAP = safeMermaidId('kokpit/parser/roadmap.ts');

const BASE_ITEM: PhaseItem = {
    id: ITEM_KEY,
    title: '`kokpit/parser/roadmap.ts` checkbox ayrıştırıcısı',
    status: 'done',
    phaseHeading: PHASE_HEADING,
    line: 7,
};

const RECEIPT_GROUPS: PhaseGroup[] = [
    { heading: PHASE_HEADING, items: [BASE_ITEM] },
];

const LIVE_REVISION = {
    kind: 'commit' as const,
    revision: 'abc1234',
    commit: 'abc1234',
    branch: 'codex/dilim-2-real-map',
};

function makeDiagram(): ReceiptDiagram {
    return {
        graph: {
            schemaVersion: 1,
            metadata: {
                projectId: 'local-kokpitpro',
                branch: 'codex/dilim-2-real-map',
                commit: 'abc1234',
                revisionKind: 'commit',
                revision: 'abc1234',
                generatedAt: '2026-08-26T10:00:00.000Z',
            },
            groups: [
                { id: 'runtime', label: 'Çalışma zamanı', description: '' },
                { id: 'analysis', label: 'Analiz', description: '' },
            ],
            nodes: [
                { id: ID_SERVER, label: 'server.ts', type: 'box', groupId: 'runtime', path: 'kokpit/server.ts' },
                { id: ID_INDEX, label: 'index.ts', type: 'box', groupId: 'analysis', path: 'kokpit/parser/index.ts' },
                { id: ID_ROADMAP, label: 'roadmap.ts', type: 'box', groupId: 'analysis', path: 'kokpit/parser/roadmap.ts' },
            ],
            edges: [
                { from: ID_SERVER, to: ID_INDEX },
                { from: ID_INDEX, to: ID_ROADMAP },
            ],
        },
        nodeEvidence: {},
        measurements: {
            scannedFileCount: 3,
            totalEdgeCount: 2,
            renderedNodeCount: 3,
            renderedEdgeCount: 2,
            unresolvedCount: 0,
            durationMs: 5,
        },
        unmatchedPlanItems: [],
        itemMappings: {
            [ITEM_ID]: {
                nodeIds: [ID_ROADMAP],
                paths: ['kokpit/parser/roadmap.ts'],
                testPaths: ['kokpit/parser/__tests__/roadmap.test.ts'],
            },
        },
    };
}

function withItemMapping(
    diagram: ReceiptDiagram,
    mapping: ReceiptDiagram['itemMappings'][string],
): ReceiptDiagram {
    return { ...diagram, itemMappings: { [ITEM_ID]: mapping } };
}

function withEdges(diagram: ReceiptDiagram, edges: ReceiptDiagram['graph']['edges']): ReceiptDiagram {
    return {
        ...diagram,
        graph: { ...diagram.graph, edges },
        measurements: { ...diagram.measurements, renderedEdgeCount: edges.length },
    };
}

function makeInput(overrides: Partial<DeltaComputeInput> = {}): DeltaComputeInput {
    return {
        projectId: 'local-kokpitpro',
        phaseHeading: PHASE_HEADING,
        itemKey: ITEM_KEY,
        receipt: {
            branch: 'codex/dilim-2-real-map',
            commit: 'abc1234',
            revisionKind: 'commit',
            revision: 'abc1234',
            groups: RECEIPT_GROUPS,
        },
        diagram: makeDiagram(),
        liveRevision: LIVE_REVISION,
        baselineDiagram: null,
        ...overrides,
    };
}

function sortByFromTo(left: { from: string; to: string }, right: { from: string; to: string }): number {
    return left.from < right.from ? -1 : left.from > right.from ? 1 : left.to < right.to ? -1 : left.to > right.to ? 1 : 0;
}

function stripDuration(result: DeltaResult): Omit<DeltaResult, 'durationMs'> {
    const { durationMs: _durationMs, ...rest } = result;
    return rest;
}

describe('computeDelta plan-madde deltası', () => {
    it('makbuz eşlemesi tamken measured döner; etki yüzeyi eşlemeden gelir', () => {
        const result = computeDelta(makeInput());
        expect(result.schemaVersion).toBe(1);
        expect(result.itemId).toBe(ITEM_ID);
        expect(result.mode).toBe('measured');
        expect(result.evidenceKind).toBe('receipt-mapping');
        expect(result.baseRevision).toEqual({
            kind: 'commit',
            revision: 'abc1234',
            commit: 'abc1234',
            branch: 'codex/dilim-2-real-map',
        });
        expect(result.affectedNodeIds).toEqual([ID_ROADMAP]);
        expect(result.affectedPaths).toEqual(['kokpit/parser/roadmap.ts']);
        expect(result.affectedTests).toEqual(['kokpit/parser/__tests__/roadmap.test.ts']);
        expect(result.declaredPaths).toEqual(['kokpit/parser/roadmap.ts']);
    });

    it('yeni bildirilen yol öneri düğümü üretir; kenar UYDURULMAZ', () => {
        const item: PhaseItem = {
            ...BASE_ITEM,
            title: '`kokpit/parser/roadmap.ts` ayrıştırıcı + docs/yeni-modul.md tasarımı',
        };
        const result = computeDelta(
            makeInput({ receipt: { ...makeInput().receipt, groups: [{ heading: PHASE_HEADING, items: [item] }] } }),
        );
        expect(result.mode).toBe('measured');
        expect(result.proposedNodes).toEqual([
            { id: safeMermaidId('docs/yeni-modul.md'), label: 'yeni-modul.md', path: 'docs/yeni-modul.md' },
        ]);
        expect(result.reasons.some((reason) => reason.code === 'edges-not-measurable-yet')).toBe(true);
        expect(result.addedEdges).toEqual([]);
        expect(result.removedEdges).toEqual([]);
    });

    it('baseline ile eklenen/çıkarılan kenarlar doğru ve sıralı hesaplanır', () => {
        const diagram = withItemMapping(makeDiagram(), {
            nodeIds: [ID_INDEX, ID_ROADMAP],
            paths: ['kokpit/parser/index.ts', 'kokpit/parser/roadmap.ts'],
            testPaths: ['kokpit/parser/__tests__/roadmap.test.ts'],
        });
        const incidentSorted = [
            { from: ID_SERVER, to: ID_INDEX },
            { from: ID_INDEX, to: ID_ROADMAP },
        ].sort(sortByFromTo);

        const addedResult = computeDelta(makeInput({ diagram, baselineDiagram: withEdges(diagram, []) }));
        expect(addedResult.mode).toBe('measured');
        expect(addedResult.addedEdges).toEqual(incidentSorted);
        expect(addedResult.removedEdges).toEqual([]);

        const removedResult = computeDelta(
            makeInput({ diagram: withEdges(diagram, []), baselineDiagram: diagram }),
        );
        expect(removedResult.addedEdges).toEqual([]);
        expect(removedResult.removedEdges).toEqual(incidentSorted);
    });

    it('baselinesız ölçümde kenarlar boş kalır ve bilgilendirici neden taşınır', () => {
        const result = computeDelta(makeInput());
        expect(result.mode).toBe('measured');
        expect(result.reasons.some((reason) => reason.code === 'comparison-baseline-unavailable')).toBe(true);
        expect(result.addedEdges).toEqual([]);
        expect(result.removedEdges).toEqual([]);
    });

    it('bayat revision → unmeasurable + stale-receipt; etki/öneri/kenar listeleri TAMAMEN boş', () => {
        const result = computeDelta(makeInput({ liveRevision: { ...LIVE_REVISION, revision: 'dead999' } }));
        expect(result.mode).toBe('unmeasurable');
        expect(result.evidenceKind).toBe('none');
        expect(result.reasons.map((reason) => reason.code)).toEqual(['stale-receipt']);
        for (const key of [
            'affectedNodeIds',
            'affectedPaths',
            'affectedTests',
            'proposedNodes',
            'addedEdges',
            'removedEdges',
        ] as const) {
            expect(result[key]).toEqual([]);
        }
    });

    it('madde yok → item-not-found; bütün listeler boş', () => {
        const result = computeDelta(
            makeInput({ receipt: { ...makeInput().receipt, groups: [] } }),
        );
        expect(result.mode).toBe('unmeasurable');
        expect(result.evidenceKind).toBe('none');
        expect(result.reasons[0]?.code).toBe('item-not-found');
        expect(result.declaredPaths).toEqual([]);
        expect(result.affectedNodeIds).toEqual([]);
        expect(result.proposedNodes).toEqual([]);
    });

    it('canlı checkout yoksa no-local-checkout ile ölçülemez işaretlenir', () => {
        const result = computeDelta(makeInput({ liveRevision: null }));
        expect(result.mode).toBe('unmeasurable');
        expect(result.reasons.map((reason) => reason.code)).toEqual(['no-local-checkout']);
        expect(result.affectedNodeIds).toEqual([]);
    });

    it('eşleme olmayan bildirim declared-only + declared-text-only olur', () => {
        const diagram = withItemMapping(makeDiagram(), {
            nodeIds: [],
            paths: [],
            testPaths: [],
        });
        const result = computeDelta(makeInput({ diagram: { ...diagram, itemMappings: {} } }));
        expect(result.mode).toBe('declared-only');
        expect(result.evidenceKind).toBe('declared-text-only');
        expect(result.reasons.map((reason) => reason.code)).toContain('paths-not-measured');
        expect(result.affectedNodeIds).toEqual([]);
    });

    it('senaryo-2 nöbetçisi: eşlemsiz grafta-karşılıksız bildirim kesikli öneri üretir, kenar uydurmaz', () => {
        const diagram = { ...makeDiagram(), itemMappings: {} };
        const proposedItem: PhaseItem = {
            ...BASE_ITEM,
            title: '`kokpit/planlar/yeni-modul.ts` eklenecek',
        };
        const result = computeDelta(makeInput({
            diagram,
            receipt: {
                branch: 'codex/dilim-2-real-map',
                commit: 'abc1234',
                revisionKind: 'commit',
                revision: 'abc1234',
                groups: [{ heading: PHASE_HEADING, items: [proposedItem] }],
            },
        }));
        expect(result.mode).toBe('declared-only');
        expect(result.proposedNodes.length).toBeGreaterThan(0);
        for (const proposal of result.proposedNodes) {
            expect(result.declaredPaths).toContain(proposal.path);
            // Önerilen yol grafta ASLA ölçülmüş düğüm değildir.
            expect(diagram.graph.nodes.some((node) => node.path === proposal.path)).toBe(false);
        }
        expect(result.reasons.map((reason) => reason.code)).toContain('edges-not-measurable-yet');
        expect(result.addedEdges).toEqual([]);
        expect(result.removedEdges).toEqual([]);
    });

    it('aynı girdi deterministiktir — durationMs hariç birebir aynı JSON', () => {
        const input = makeInput();
        const left = stripDuration(computeDelta(input));
        const right = stripDuration(computeDelta(input));
        expect(left).toEqual(right);
        expect(JSON.stringify(left)).toBe(JSON.stringify(right));
    });

    it('bilinmeyen düğüm kimliğini TypeError ile patlatır — sessiz yutma yok', () => {
        const diagram = withItemMapping(makeDiagram(), {
            nodeIds: ['ghost_node'],
            paths: ['kokpit/parser/roadmap.ts'],
            testPaths: [],
        });
        expect(() => computeDelta(makeInput({ diagram }))).toThrow(TypeError);
    });

    it('strict şema bilinmeyen alanı reddeder', () => {
        const valid = computeDelta(makeInput());
        const corrupted = { ...stripDuration(valid), unexpectedField: true };
        expect(DeltaResult.safeParse(corrupted).success).toBe(false);
        expect(DeltaResult.safeParse(valid).success).toBe(true);
    });
});
