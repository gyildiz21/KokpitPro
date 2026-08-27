import { describe, expect, it } from 'vitest';
import {
    architectureGroupIdForPath,
    architectureGroupsForPaths,
    measuredImportPresentation,
} from '../architecture';

describe('path-derived architecture groups', () => {
    it('classifies common frontend, backend, analysis, service and workflow paths deterministically', () => {
        expect(architectureGroupIdForPath('src/components/ProjectCard.tsx')).toBe('interface');
        expect(architectureGroupIdForPath('functions/src/handlers/oauth.ts')).toBe('runtime');
        expect(architectureGroupIdForPath('kokpit/diagram/compile.ts')).toBe('analysis');
        expect(architectureGroupIdForPath('src/services/firebase.ts')).toBe('integration');
        expect(architectureGroupIdForPath('src/workflows/FinanceWorkflow.ts')).toBe('automation');
        expect(architectureGroupIdForPath('src/index.ts')).toBe('shared');
    });

    it('emits only used groups in stable rule order', () => {
        expect(architectureGroupsForPaths([
            'src/services/api.ts',
            'src/components/App.tsx',
            'src/index.ts',
        ]).map((group) => group.id)).toEqual(['interface', 'integration', 'shared']);
    });
});

describe('measured import relation language', () => {
    const base = { from: 'a.ts', to: 'b.ts', resolved: true, dynamic: false, typeOnly: false };

    it('labels only measured relation kinds and cross-group imports', () => {
        expect(measuredImportPresentation(base, 'analysis', 'analysis')).toEqual({ style: 'solid' });
        expect(measuredImportPresentation(base, 'interface', 'runtime')).toEqual({ label: 'imports', style: 'solid' });
        expect(measuredImportPresentation({ ...base, dynamic: true }, 'interface', 'runtime')).toEqual({ label: 'dynamic import', style: 'dashed' });
        expect(measuredImportPresentation({ ...base, typeOnly: true }, 'analysis', 'analysis')).toEqual({ label: 'type import', style: 'dashed' });
    });
});
