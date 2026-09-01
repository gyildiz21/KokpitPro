// Delta neden-sözleşmesi nöbetçileri — Dilim 5.2 (UI-SPEC §10.9.4, DESIGN D8.6).
//
// computeDelta'ın gerçek imzası kokpit/delta/compute.ts'ten okunur ve şu
// sözleşme sabitlenir: ölçülemez sonuçta reasons[] boş KALMAZ ve yalnız
// bilinen kod kümesinden üretilir; madde grafla eşleşmezse uydurma yol/test
// listesi ÜRETİLMEZ; measured yüzey yalnız gerçek eşlemeden gelir; aynı
// girdi durationMs hariç birebir aynıdır. Hermetik: I/O yok, ağ yok.

import { describe, expect, it } from 'vitest';
import { computeDelta, type DeltaComputeInput } from '../compute';
import { DeltaReasonCode, type DeltaResult } from '../schema';
import type { ReceiptDiagram } from '../../diagram/receipt-adapter';
import type { PhaseGroup, PhaseItem } from '../../parser/schema';
import { safeMermaidId } from '../../diagram/mermaid-sanitize';

/** Şemanın kutsal kod kümesi — motorun bilinmeyen kod üretmesi yasaktır. */
const KNOWN_REASON_CODES: readonly string[] = [...DeltaReasonCode.options];

const PHASE = 'Dilim 5 · Uyum Telemetrisi';
// Dilim 5.2'nin maddelerinin KOD EŞLEMESİ yoktur — dürüst sınır budur.
const PHASE_52 = 'Dilim 5.2 · Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit';

const BRANCH = 'codex/dilim-5-2-delta-timeline';
const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

const TELEMETRY_ITEM: PhaseItem = {
    id: 'madde-1',
    title: '`kokpit/server.ts` telemetri kabulü',
    status: 'done',
    phaseHeading: PHASE,
    line: 5,
};

// Dikkat: başlıkta hiç yol-benzeri bildirim yoktur (5.2 maddeleri böyledir).
const COCKPIT_ITEM: PhaseItem = {
    id: 'madde-1',
    title: '5.2.0 — Sözleşme dondurma',
    status: 'open',
    phaseHeading: PHASE_52,
    line: 12,
};

const GROUPS: PhaseGroup[] = [
    { heading: PHASE, items: [TELEMETRY_ITEM] },
    { heading: PHASE_52, items: [COCKPIT_ITEM] },
];

const LIVE_REVISION = {
    kind: 'commit' as const,
    revision: COMMIT,
    commit: COMMIT,
    branch: BRANCH,
};

const ID_SERVER = safeMermaidId('kokpit/server.ts');

function makeDiagram(): ReceiptDiagram {
    return {
        graph: {
            schemaVersion: 1,
            metadata: {
                projectId: 'local-kokpitpro',
                branch: BRANCH,
                commit: COMMIT,
                revisionKind: 'commit',
                revision: COMMIT,
                generatedAt: '2026-08-31T10:00:00.000Z',
            },
            groups: [{ id: 'runtime', label: 'Çalışma zamanı', description: '' }],
            nodes: [
                { id: ID_SERVER, label: 'server.ts', type: 'box', groupId: 'runtime', path: 'kokpit/server.ts' },
            ],
            edges: [],
        },
        nodeEvidence: {},
        measurements: {
            scannedFileCount: 1,
            totalEdgeCount: 0,
            renderedNodeCount: 1,
            renderedEdgeCount: 0,
            unresolvedCount: 0,
            durationMs: 3,
        },
        unmatchedPlanItems: [],
        itemMappings: {
            [`${PHASE}::madde-1`]: {
                nodeIds: [ID_SERVER],
                paths: ['kokpit/server.ts'],
                testPaths: ['kokpit/parser/__tests__/roadmap.test.ts'],
            },
        },
    };
}

function makeInput(overrides: Partial<DeltaComputeInput> = {}): DeltaComputeInput {
    return {
        projectId: 'local-kokpitpro',
        phaseHeading: PHASE_52,
        itemKey: 'madde-1',
        receipt: {
            branch: BRANCH,
            commit: COMMIT,
            revisionKind: 'commit',
            revision: COMMIT,
            groups: GROUPS,
        },
        diagram: makeDiagram(),
        liveRevision: LIVE_REVISION,
        baselineDiagram: null,
        ...overrides,
    };
}

function stripDuration(result: DeltaResult): Omit<DeltaResult, 'durationMs'> {
    const { durationMs: _durationMs, ...rest } = result;
    return rest;
}

/** Ölçülemez sonuçta neden boş kalmaz ve yalnız bilinen kümeden üretilir. */
function expectHonestReasons(result: DeltaResult): void {
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const reason of result.reasons) {
        expect(KNOWN_REASON_CODES).toContain(reason.code);
        expect(reason.message.length).toBeGreaterThan(0);
    }
}

/** Ölçülemez sonuçta hiçbir etki/öneri listesi uydurulmaz. */
function expectNoInventedSurface(result: DeltaResult): void {
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
}

describe('delta neden-sözleşmesi — unmeasurable dürüstlüğü', () => {
    const unmeasurableScenarios: ReadonlyArray<readonly [string, DeltaComputeInput]> = [
        ['madde hiçbir grupta yok', makeInput({
            phaseHeading: PHASE,
            itemKey: 'hayali-madde',
            receipt: { ...makeInput().receipt, groups: [] },
        })],
        ['canlı checkout yok', makeInput({ liveRevision: null })],
        ['makbuz damgası canlıdan bayat', makeInput({
            liveRevision: { ...LIVE_REVISION, revision: 'dead999' },
        })],
        ['makbuzda revizyon damgası yok', makeInput({
            receipt: { ...makeInput().receipt, revision: undefined },
        })],
        ['5.2 maddesi: eşleme de bildirilen yol da yok', makeInput()],
    ];

    for (const [scenario, input] of unmeasurableScenarios) {
        it(`${scenario} → mode unmeasurable; reasons boş DEĞİL ve kodlar bilinen kümeden`, () => {
            const result = computeDelta(input);
            expect(result.mode).toBe('unmeasurable');
            expect(result.evidenceKind).toBe('none');
            expectHonestReasons(result);
            expectNoInventedSurface(result);
        });
    }

    it('her unmeasurable senaryonun kodu beklenen sınıfa düşer', () => {
        expect(computeDelta(makeInput({
            phaseHeading: PHASE,
            itemKey: 'hayali-madde',
            receipt: { ...makeInput().receipt, groups: [] },
        })).reasons.map((reason) => reason.code)).toEqual(['item-not-found']);
        expect(computeDelta(makeInput({ liveRevision: null })).reasons.map((reason) => reason.code))
            .toEqual(['no-local-checkout']);
        expect(computeDelta(makeInput({ liveRevision: { ...LIVE_REVISION, revision: 'dead999' } }))
            .reasons.map((reason) => reason.code)).toEqual(['stale-receipt']);
        expect(computeDelta(makeInput({ receipt: { ...makeInput().receipt, revision: undefined } }))
            .reasons.map((reason) => reason.code)).toEqual(['no-mapping']);
        expect(computeDelta(makeInput()).reasons.map((reason) => reason.code)).toEqual(['no-mapping']);
    });
});

describe('delta neden-sözleşmesi — uydurma yüzey yasağı', () => {
    it('madde grafla eşleşmezse paths-not-measured dürüst döner; affectedPaths/affectedTests ÜRETİLMEZ', () => {
        // Madde var, başlığında yol bildirimi var, ama makbuz eşlemesi yok.
        const input = makeInput({
            phaseHeading: PHASE,
            itemKey: 'madde-1',
            diagram: { ...makeDiagram(), itemMappings: {} },
        });
        const result = computeDelta(input);
        expect(result.mode).toBe('declared-only');
        expect(result.evidenceKind).toBe('declared-text-only');
        expect(result.reasons.map((reason) => reason.code)).toContain('paths-not-measured');
        // Bildirilen yol salt METİNDEN gelir; ölçülmüş yüzey uydurulmaz.
        expect(result.declaredPaths).toEqual(['kokpit/server.ts']);
        expect(result.affectedPaths).toEqual([]);
        expect(result.affectedTests).toEqual([]);
        expect(result.affectedNodeIds).toEqual([]);
    });

    it('eşleme olmayan grafta karşılıksız bildirim yalnız ÖNERİ düğümü üretir; kenar uydurmaz', () => {
        const proposedItem: PhaseItem = {
            ...TELEMETRY_ITEM,
            title: '`kokpit/planlar/yeni-modul.ts` eklenecek',
        };
        const result = computeDelta(makeInput({
            phaseHeading: PHASE,
            itemKey: 'madde-1',
            receipt: { ...makeInput().receipt, groups: [{ heading: PHASE, items: [proposedItem] }] },
            diagram: { ...makeDiagram(), itemMappings: {} },
        }));
        expect(result.mode).toBe('declared-only');
        expect(result.reasons.map((reason) => reason.code)).toContain('edges-not-measurable-yet');
        for (const proposal of result.proposedNodes) {
            expect(result.declaredPaths).toContain(proposal.path);
        }
        expect(result.addedEdges).toEqual([]);
        expect(result.removedEdges).toEqual([]);
    });

    it('no-mapping sonuçta paths/tests listeleri tamamen boştur — sessiz örnek veri yok', () => {
        const result = computeDelta(makeInput());
        expectHonestReasons(result);
        expect(result.reasons.map((reason) => reason.code)).toContain('no-mapping');
        expect(result.declaredPaths).toEqual([]);
        expect(result.affectedPaths).toEqual([]);
        expect(result.affectedTests).toEqual([]);
        expect(result.proposedNodes).toEqual([]);
    });
});

describe('delta neden-sözleşmesi — measured gerçek eşlemeden gelir', () => {
    it('affectedPaths/affectedTests makbuz eşlemesinin birebir kendisidir', () => {
        const result = computeDelta(makeInput({
            phaseHeading: PHASE,
            itemKey: 'madde-1',
        }));
        expect(result.mode).toBe('measured');
        expect(result.evidenceKind).toBe('receipt-mapping');
        expect(result.affectedNodeIds).toEqual([ID_SERVER]);
        expect(result.affectedPaths).toEqual(['kokpit/server.ts']);
        expect(result.affectedTests).toEqual(['kokpit/parser/__tests__/roadmap.test.ts']);
    });

    it('eşlemede olmayan yol sonuca sızmaz; eşleme boşaltılırsa measured SANILMAZ', () => {
        const diagram = makeDiagram();
        diagram.itemMappings[`${PHASE}::madde-1`] = {
            nodeIds: [ID_SERVER],
            paths: ['kokpit/server.ts'],
            testPaths: [],
        };
        const narrowed = computeDelta(makeInput({ phaseHeading: PHASE, itemKey: 'madde-1', diagram }));
        expect(narrowed.mode).toBe('measured');
        expect(narrowed.affectedTests).toEqual([]);

        const emptied = makeDiagram();
        emptied.itemMappings[`${PHASE}::madde-1`] = { nodeIds: [], paths: [], testPaths: [] };
        const honest = computeDelta(makeInput({ phaseHeading: PHASE, itemKey: 'madde-1', diagram: emptied }));
        // Madde başlığı yol bildirir: declared-only + paths-not-measured dürüst hâli.
        expect(honest.mode).toBe('declared-only');
        expect(honest.reasons.map((reason) => reason.code)).toContain('paths-not-measured');
        expect(honest.affectedPaths).toEqual([]);
    });
});

describe('delta neden-sözleşmesi — determinizm', () => {
    it('aynı girdi durationMs hariç birebir aynı JSON\u2019dur', () => {
        const input = makeInput();
        const measured = stripDuration(computeDelta({ ...input, phaseHeading: PHASE }));
        const measuredAgain = stripDuration(computeDelta({ ...input, phaseHeading: PHASE }));
        expect(measured).toEqual(measuredAgain);
        expect(JSON.stringify(measured)).toBe(JSON.stringify(measuredAgain));

        const honest = stripDuration(computeDelta(input));
        const honestAgain = stripDuration(computeDelta(input));
        expect(honest).toEqual(honestAgain);
        expect(JSON.stringify(honest)).toBe(JSON.stringify(honestAgain));
        // İki madde yolu birbirine karışmaz.
        expect(measured.itemId).not.toBe(honest.itemId);
    });
});
