import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parseGithubRepository } from './github';
import { indexLocalProject } from './local';
import { summarizePlanText } from './plan';
import { ProjectRegistry } from './registry';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const temporaryDirectories: string[] = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('persistent project registry', () => {
    it('indexes the actual local Git root and persists a validated receipt', async () => {
        const project = await indexLocalProject({ path: root, planPath: 'PLAN.md', name: 'KokpitPro' });
        expect(project.source.type).toBe('local');
        expect(project.index.commit).toMatch(/^[0-9a-f]{40}$/);
        expect(project.index.revisionKind).toMatch(/^(commit|working-tree)$/);
        expect(project.index.revision).toMatch(/^(?:[0-9a-f]{40}|worktree-[0-9a-f]{20})$/);
        expect(project.index.summary.itemCount).toBeGreaterThan(0);
        expect(project.index.nodes.length).toBeGreaterThan(0);

        const dataDir = mkdtempSync(resolve(tmpdir(), 'kokpit-registry-'));
        temporaryDirectories.push(dataDir);
        const registry = new ProjectRegistry(dataDir);
        registry.upsert(project, true);

        const reloaded = new ProjectRegistry(dataDir).read();
        expect(reloaded.activeProjectId).toBe(project.id);
        expect(reloaded.projects[0]?.index.commit).toBe(project.index.commit);
        expect(JSON.parse(readFileSync(registry.filePath, 'utf8')).version).toBe(1);

        registry.write(reloaded);
        expect(readdirSync(dataDir).filter((name) => name.endsWith('.tmp'))).toEqual([]);
        expect(new ProjectRegistry(dataDir).read()).toEqual(reloaded);
    });

    it('rejects a plan path outside the selected repository root', async () => {
        await expect(indexLocalProject({ path: root, planPath: '../outside.md' })).rejects.toThrow('No readable plan file found');
    });
});
describe('plan and GitHub adapters', () => {
    it('indexes evidence-ledger bullets when a handoff has no checkboxes', () => {
        const summary = summarizePlanText('## LIVE CURSOR — RUNTIME CLOSED\n- **Result:** delivered\n- **Proof:** 12/12\n## NEXT — RUNTIME LOCKED\n- **Gate:** withheld', 'DEVIR_TESLIM.md');
        expect(summary).toEqual({ phaseCount: 2, itemCount: 3, doneCount: 2, partialCount: 1, openCount: 0 });
    });

    it('accepts owner/repo and github.com URLs without accepting extra path segments', () => {
        expect(parseGithubRepository('openai/codex')).toEqual({ owner: 'openai', repo: 'codex' });
        expect(parseGithubRepository('https://github.com/openai/codex.git')).toEqual({ owner: 'openai', repo: 'codex' });
        expect(() => parseGithubRepository('https://github.com/openai/codex/issues')).toThrow('owner/repo');
    });
});
