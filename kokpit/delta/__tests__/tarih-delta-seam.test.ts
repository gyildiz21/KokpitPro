// Tarih-delta dikiş nöbetçisi — Dilim 3 kapanış kanıtı (2026-08-27).
//
// server.ts üretim akışını BİREBİR taklit eder: GET /diagram başarısında
// DeltaHistoryStore.record(...), GET /delta'da baselineFor(...) çıktısı
// computeDelta'ya baselineDiagram olarak verilir. Bu test, o iki halkanın
// birlikte eklenen/kaldırılan kenarları dürüstçe ölçtüğünü sabitler —
// yalnız deposunun değil dikişin de çalıştığı kanıtlanır.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiagramGraph } from '../../diagram/graph-schema';
import type { ReceiptDiagram } from '../../diagram/receipt-adapter';
import { computeDelta } from '../compute';
import { DeltaHistoryStore } from '../history';

const PROJECT = 'local-seam-proje';
const BRANCH = 'codex/dilim-2-real-map';
const PHASE_HEADING = 'Dilim 3 · Tarih-delta kapanışı';
const ITEM_KEY = 'madde-1';

const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function graphOf(revision: string, edges: DiagramGraph['edges']): DiagramGraph {
    return {
        schemaVersion: 1,
        metadata: {
            projectId: PROJECT,
            branch: BRANCH,
            commit: revision,
            revisionKind: 'commit',
            revision,
            generatedAt: '2026-08-27T09:00:00.000Z',
        },
        groups: [],
        nodes: [
            { id: 'node_a', label: 'a.ts', type: 'box', path: 'kokpit/a.ts' },
            { id: 'node_b', label: 'b.ts', type: 'box', path: 'kokpit/b.ts' },
            { id: 'node_c', label: 'c.ts', type: 'box', path: 'kokpit/c.ts' },
        ],
        edges,
    };
}

/** Sunucunun /diagram yanından aldığı şekil — receipt.graph yeterli yüzeyi taşır. */
function measuredReceipt(revision: string, edges: DiagramGraph['edges']): ReceiptDiagram {
    const itemId = `${PHASE_HEADING}::${ITEM_KEY}`;
    const nodeEvidence = Object.fromEntries(
        ['node_a', 'node_b', 'node_c'].map((id) => [id, {
            projectId: PROJECT,
            branch: BRANCH,
            commit: revision,
            revisionKind: 'commit' as const,
            revision,
            path: `kokpit/${id.split('_')[1]}.ts`,
            testPaths: [],
            evidenceKind: 'unmeasured' as const,
        }]),
    );
    return {
        graph: graphOf(revision, edges),
        nodeEvidence,
        measurements: {
            scannedFileCount: 3,
            totalEdgeCount: edges.length,
            renderedNodeCount: 3,
            renderedEdgeCount: edges.length,
            unresolvedCount: 0,
            durationMs: 4,
        },
        unmatchedPlanItems: [],
        itemMappings: {
            [itemId]: {
                nodeIds: ['node_a'],
                paths: ['kokpit/a.ts'],
                testPaths: ['kokpit/__tests__/a.test.ts'],
            },
        },
    };
}

function seamInput(
    store: DeltaHistoryStore,
    currentRevision: string,
    currentEdges: DiagramGraph['edges'],
): Parameters<typeof computeDelta>[0] {
    const baseRevision = { kind: 'commit' as const, revision: currentRevision, commit: currentRevision, branch: BRANCH };
    // Canlı makbuz doğrulaması buildProjectDiagram içinde tazeliği kanıtladı;
    // dikiş testinde canlı == temel eşitliğiyle geçilir (aynı argüman deseni).
    return {
        projectId: PROJECT,
        phaseHeading: PHASE_HEADING,
        itemKey: ITEM_KEY,
        receipt: {
            branch: BRANCH,
            commit: currentRevision,
            revisionKind: 'commit',
            revision: currentRevision,
            groups: [{
                heading: PHASE_HEADING,
                items: [{
                    id: ITEM_KEY,
                    title: '`kokpit/a.ts` kabulü',
                    status: 'done',
                    phaseHeading: PHASE_HEADING,
                    line: 9,
                }],
            }],
        },
        diagram: measuredReceipt(currentRevision, currentEdges),
        liveRevision: baseRevision,
        baselineDiagram: store.baselineFor(PROJECT, currentRevision),
    };
}

describe('tarih-delta dikişi (store → computeDelta, sunucu desenindeki gibi)', () => {
    it('iki farklı makbuzla eklenen/kaldırılan kenarları sıralı ölçer; uydurma yok', () => {
        const dataDir = mkdtempSync(resolve(tmpdir(), 'kokpit-tarih-delta-'));
        temporaryDirectories.push(dataDir);
        const store = new DeltaHistoryStore(dataDir);

        const revA = 'a'.repeat(40);
        const revB = 'b'.repeat(40);
        const edgesA: DiagramGraph['edges'] = [
            { from: 'node_a', to: 'node_b' },
            { from: 'node_a', to: 'node_c' },
        ];
        const edgesB: DiagramGraph['edges'] = [
            { from: 'node_a', to: 'node_b' },
            { from: 'node_c', to: 'node_a' },
        ];

        // Üretim sırası: her başarılı /diagram koşumu snapshot'ı kaydeder;
        // /delta ise ÖNCE güncel makbuzun kendisi depoda olmalı (record B),
        // sonra baselineFor(=B) bir öncekini(A) verir.
        store.record(PROJECT, revA, graphOf(revA, edgesA));
        store.record(PROJECT, revB, graphOf(revB, edgesB));
        expect(store.baselineFor(PROJECT, revB)).not.toBeNull();

        const result = computeDelta(seamInput(store, revB, edgesB));
        expect(result.mode).toBe('measured');
        expect(result.evidenceKind).toBe('receipt-mapping');
        expect(result.reasons.map((reason) => reason.code)).not.toContain('comparison-baseline-unavailable');
        expect(result.addedEdges).toEqual([{ from: 'node_c', to: 'node_a' }]);
        expect(result.removedEdges).toEqual([{ from: 'node_a', to: 'node_c' }]);
    });

    it('değişmeyen kenar kümesi added/removed BOŞ bırakır; sentetik fark uydurmaz', () => {
        const dataDir = mkdtempSync(resolve(tmpdir(), 'kokpit-tarih-delta-'));
        temporaryDirectories.push(dataDir);
        const store = new DeltaHistoryStore(dataDir);
        const sameEdges: DiagramGraph['edges'] = [{ from: 'node_a', to: 'node_b' }];

        store.record(PROJECT, 'r-a', graphOf('r-a', sameEdges));
        store.record(PROJECT, 'r-b', graphOf('r-b', sameEdges));

        const result = computeDelta(seamInput(store, 'r-b', sameEdges));
        expect(result.addedEdges).toEqual([]);
        expect(result.removedEdges).toEqual([]);
    });

    it('son-iki penceresi dürüsttür: üçüncü ölçüm en eskiyi düşürür, baseline bir adım kayar', () => {
        const dataDir = mkdtempSync(resolve(tmpdir(), 'kokpit-tarih-delta-'));
        temporaryDirectories.push(dataDir);
        const store = new DeltaHistoryStore(dataDir);
        const e1: DiagramGraph['edges'] = [{ from: 'node_a', to: 'node_b' }];
        const e2: DiagramGraph['edges'] = [{ from: 'node_b', to: 'node_a' }];
        const e3: DiagramGraph['edges'] = [];

        store.record(PROJECT, 'rev-1', graphOf('rev-1', e1));
        store.record(PROJECT, 'rev-2', graphOf('rev-2', e2));
        store.record(PROJECT, 'rev-3', graphOf('rev-3', e3));

        const latestBaseline = store.baselineFor(PROJECT, 'rev-3');
        expect(latestBaseline?.graph.metadata.revision).toBe('rev-2');
        expect(store.baselineFor(PROJECT, 'rev-1')).toBeNull();
    });
});
