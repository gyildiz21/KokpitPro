import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { ProjectRecord, type ProjectNode, type ProjectRecord as ProjectRecordType } from './schema';
import { indexPlanText } from './plan';

const execFileAsync = promisify(execFile);
const PLAN_CANDIDATES = ['PLAN.md', 'ROADMAP.md', 'DEVIR_TESLIM.md', 'docs/PLAN.md', 'docs/ROADMAP.md'];
const NODE_PRIORITY = ['src', 'app', 'frontend', 'backend', 'functions', 'services', 'kokpit', 'packages'];
const NODE_EXCLUDES = new Set(['.git', '.kokpit', 'node_modules', 'dist', 'coverage', 'output', 'build', '.next']);

async function git(root: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', ['-C', root, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
}

function isInside(root: string, target: string): boolean {
    const rel = relative(root, target);
    return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function resolvePlan(root: string, requested?: string): { path: string; relativePath: string } {
    const candidates = requested && requested !== 'auto' ? [requested] : PLAN_CANDIDATES;
    for (const candidate of candidates) {
        const full = realpathIfExists(resolve(root, candidate));
        if (!full || !isInside(root, full) || !statSync(full).isFile()) continue;
        if (statSync(full).size > 2 * 1024 * 1024) throw new Error(`Plan file is too large: ${candidate}`);
        return { path: full, relativePath: relative(root, full).replaceAll('\\', '/') };
    }
    throw new Error(`No readable plan file found. Tried: ${candidates.join(', ')}`);
}

function realpathIfExists(path: string): string | null {
    return existsSync(path) ? realpathSync(path) : null;
}

function discoverNodes(root: string): ProjectNode[] {
    const entries = readdirSync(root, { withFileTypes: true })
        .filter((entry) => !NODE_EXCLUDES.has(entry.name) && !entry.name.startsWith('.'))
        .filter((entry) => entry.isDirectory() || /\.(?:ts|tsx|js|jsx|py|go|rs)$/i.test(entry.name));
    entries.sort((a, b) => {
        const aPriority = NODE_PRIORITY.indexOf(a.name);
        const bPriority = NODE_PRIORITY.indexOf(b.name);
        if (aPriority >= 0 || bPriority >= 0) return (aPriority < 0 ? 999 : aPriority) - (bPriority < 0 ? 999 : bPriority);
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    return entries.slice(0, 5).map((entry) => ({
        id: createHash('sha1').update(entry.name).digest('hex').slice(0, 10),
        title: entry.isDirectory() ? `${entry.name}/` : entry.name,
        path: entry.name,
        kind: entry.isDirectory() ? 'directory' : 'file',
        status: 'done',
        evidence: `Verified on disk at ${resolve(root, entry.name)}`,
    }));
}

export interface LocalProjectInput {
    path: string;
    planPath?: string;
    name?: string;
}

export async function indexLocalProject(input: LocalProjectInput, previous?: ProjectRecordType): Promise<ProjectRecordType> {
    if (!input.path?.trim()) throw new Error('Local repository path is required.');
    const root = realpathSync(resolve(input.path.trim()));
    if (!statSync(root).isDirectory()) throw new Error('Local repository path is not a directory.');
    const gitRoot = realpathSync(await git(root, ['rev-parse', '--show-toplevel']));
    if (gitRoot !== root) throw new Error(`Select the Git repository root: ${gitRoot}`);
    const branch = (await git(root, ['branch', '--show-current'])) || 'DETACHED';
    const commit = await git(root, ['rev-parse', 'HEAD']);
    const remoteUrl = await git(root, ['remote', 'get-url', 'origin']).catch(() => '');
    const plan = resolvePlan(root, input.planPath);
    const planMarkdown = readFileSync(plan.path, 'utf8');
    const planIndex = indexPlanText(planMarkdown, plan.relativePath);
    const now = new Date().toISOString();
    const identity = root.toLocaleLowerCase('en-US');
    const id = previous?.id ?? `local-${createHash('sha256').update(identity).digest('hex').slice(0, 12)}`;
    const record: ProjectRecordType = {
        id,
        name: input.name?.trim() || previous?.name || basename(root),
        source: { type: 'local', root, ...(remoteUrl ? { remoteUrl } : {}) },
        branch,
        authMode: 'local',
        connectionState: 'ready',
        index: {
            indexedAt: now,
            commit,
            branch,
            planPath: plan.relativePath,
            planMarkdown,
            groups: planIndex.groups,
            summary: planIndex.summary,
            nodes: discoverNodes(root),
        },
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        lastError: null,
    };
    return ProjectRecord.parse(record);
}
