import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiagramGraph } from '../../diagram/graph-schema';
import { DeltaHistoryStore } from '../history';

const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function graph(revision: string, edges: DiagramGraph['edges']): DiagramGraph {
    return {
        schemaVersion: 1,
        metadata: {
            projectId: 'project-a', branch: 'main', commit: revision,
            revisionKind: 'commit', revision, generatedAt: '2026-08-27T00:00:00.000Z',
        },
        groups: [],
        nodes: [
            { id: 'node_a', label: 'a.ts', type: 'box', path: 'a.ts' },
            { id: 'node_b', label: 'b.ts', type: 'box', path: 'b.ts' },
        ],
        edges,
    };
}

describe('DeltaHistoryStore', () => {
    it('proje başına son iki farklı ölçümü tutar ve bir öncekini baseline verir', () => {
        const dataDir = mkdtempSync(resolve(tmpdir(), 'kokpit-delta-history-'));
        temporaryDirectories.push(dataDir);
        const store = new DeltaHistoryStore(dataDir);
        const first = graph('a'.repeat(40), []);
        const second = graph('b'.repeat(40), [{ from: 'node_a', to: 'node_b', relation: 'static-import', evidence: './b' }]);

        store.record('project-a', 'rev-1', first);
        expect(store.baselineFor('project-a', 'rev-1')).toBeNull();
        store.record('project-a', 'rev-2', second);
        store.record('project-a', 'rev-2', second);

        expect(store.baselineFor('project-a', 'rev-2')?.graph).toEqual(first);
        expect(store.read().projects['project-a']).toHaveLength(2);
        expect(readdirSync(dataDir).filter((name) => name.endsWith('.tmp'))).toEqual([]);

        expect(store.remove('project-a')).toBe(true);
        expect(store.remove('project-a')).toBe(false);
        expect(store.read().projects['project-a']).toBeUndefined();
    });
});
