import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildProjectDiagram, githubFileLinkBase } from '../diagram-service';
import type { PhaseGroup } from '../../parser/schema';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const staticFixture = resolve(root, 'kokpit', 'importgraph', '__fixtures__', 'importgraph', 'static-import');

const GROUPS: PhaseGroup[] = [
    {
        heading: 'F',
        items: [
            { id: 'm-1', title: 'a.ts modülü tamamlandı', status: 'done', phaseHeading: 'F', line: 1 },
            { id: 'm-2', title: 'b.ts sürüyor', status: 'partial', phaseHeading: 'F', line: 2 },
        ],
    },
];

describe('githubFileLinkBase', () => {
    it('yalnız github.com adreslerinden temel üretir; diğerlerini reddeder', () => {
        expect(githubFileLinkBase('https://github.com/owner/repo.git')).toBe('https://github.com/owner/repo');
        expect(githubFileLinkBase('git@github.com:owner/repo.git')).toBe('https://github.com/owner/repo');
        expect(githubFileLinkBase('https://gitlab.com/owner/repo')).toBeUndefined();
        expect(githubFileLinkBase(undefined)).toBeUndefined();
    });
});

describe('buildProjectDiagram dürüstlük sözleşmesi', () => {
    it('yerel kökü olmayan kaynağı ölçülemez sayar; tahmin üretmez', async () => {
        const result = await buildProjectDiagram({
            projectId: 'p-github',
            branch: 'main',
            commit: 'abc',
            groups: [],
        });
        expect(result.measurable).toBe(false);
        if (!result.measurable) expect(result.reason).toBe('no-local-checkout');
    });

    it('var olmayan yerel kökte ölçülemez nedeni döner', async () => {
        const result = await buildProjectDiagram({
            projectId: 'p-lost',
            sourceRoot: resolve(root, 'kokpit', '__yok_boyle_dizin__'),
            branch: 'main',
            commit: 'abc',
            groups: [],
        });
        expect(result.measurable).toBe(false);
    });

    it('gerçek fixture taramasından makbuzlu graf + mermaid üretir; plan-path kanıtı taşır', async () => {
        const result = await buildProjectDiagram({
            projectId: 'p-fixture',
            sourceRoot: staticFixture,
            remoteUrl: 'git@github.com:owner/repo.git',
            branch: 'main',
            commit: '8821a1e36da3d164137f36e43978c7a01fd06bd1',
            groups: GROUPS,
        });
        expect(result.measurable).toBe(true);
        if (!result.measurable) return;
        expect(result.mermaid.startsWith('flowchart TD\n')).toBe(true);
        expect(result.fileLinkBase).toBe('https://github.com/owner/repo');
        const evidenceValues = Object.values(result.receipt.nodeEvidence);
        const matched = evidenceValues.filter((evidence) => evidence.evidenceKind === 'plan-path-match');
        expect(matched.length).toBeGreaterThanOrEqual(2);
        for (const evidence of matched) {
            expect(evidence.projectId).toBe('p-fixture');
        }
        // Mermaid çıktısı güvenli kaynak linkini taşır (dal segmentleri korunur).
        expect(result.mermaid).toContain('click node_');
        expect(result.mermaid).toContain('blob/main/');
    });

    it('aynı girdiyle servis çıktısı deterministiktir (zaman damgaları hariç)', async () => {
        const input = {
            projectId: 'p-det',
            sourceRoot: staticFixture,
            branch: 'main',
            commit: 'abc',
            groups: GROUPS,
        };
        const left = await buildProjectDiagram(input);
        const right = await buildProjectDiagram(input);
        expect(left.measurable && right.measurable).toBe(true);
        if (!left.measurable || !right.measurable) return;
        expect(left.mermaid).toEqual(right.mermaid);
        expect(left.receipt.graph.metadata.generatedAt).not.toBe(right.receipt.graph.metadata.generatedAt);
        left.receipt.graph.metadata.generatedAt = '';
        right.receipt.graph.metadata.generatedAt = '';
        expect(left.receipt.graph).toEqual(right.receipt.graph);
    });
});
