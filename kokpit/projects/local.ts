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

async function gitRaw(root: string, args: string[], maxBuffer = 16 * 1024 * 1024): Promise<string> {
    const { stdout } = await execFileAsync('git', ['-C', root, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer,
    });
    return stdout;
}

export interface LocalRevision {
    branch: string;
    commit: string;
    dirty: boolean;
    kind: 'commit' | 'working-tree';
    /** Commit SHA veya içerik-duyarlı `worktree-<sha256>` makbuzu. */
    revision: string;
}

/**
 * Kalıcı kayıt ile aynı anda okunan canlı Git makbuzundan tek bağlantı durumu
 * üretir. Katalog, üst bağlam ve diyagram bu kararı paylaşır; kayıt dosyasındaki
 * eski `ready` değeri canlı çalışma ağacı değişimini gizleyemez.
 */
export function withLocalFreshness(
    project: ProjectRecordType,
    current: LocalRevision,
): ProjectRecordType {
    if (project.source.type !== 'local') return project;
    const expectedKind = project.index.revisionKind ?? 'commit';
    const expectedRevision = project.index.revision ?? project.index.commit;
    const fresh = current.branch === project.index.branch
        && current.commit === project.index.commit
        && current.kind === expectedKind
        && current.revision === expectedRevision;
    return ProjectRecord.parse({
        ...project,
        connectionState: fresh ? 'ready' : 'stale',
        lastError: fresh ? null : 'stale-receipt',
    });
}

export async function refreshProjectFreshness(project: ProjectRecordType): Promise<ProjectRecordType> {
    if (project.source.type !== 'local') return project;
    try {
        return withLocalFreshness(project, await readLocalRevision(project.source.root));
    } catch (error) {
        return ProjectRecord.parse({
            ...project,
            connectionState: 'error',
            lastError: `revision-check-failed:${error instanceof Error ? error.message : String(error)}`,
        });
    }
}

/**
 * Yerel çalışma ağacının kanonik makbuzu. Kirli durumda yalnız dosya adlarını
 * değil diff'i ve izlenmeyen dosya içeriklerini de hash'ler; böylece iki farklı
 * çalışma ağacı aynı commit makbuzu gibi sunulamaz.
 */
export async function readLocalRevision(root: string): Promise<LocalRevision> {
    const branch = (await git(root, ['branch', '--show-current'])) || 'DETACHED';
    const commit = await git(root, ['rev-parse', 'HEAD']);
    const status = await gitRaw(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    if (!status) return { branch, commit, dirty: false, kind: 'commit', revision: commit };

    const diff = await gitRaw(root, ['diff', '--binary', '--no-ext-diff', 'HEAD', '--', '.']);
    const untrackedRaw = await gitRaw(root, ['ls-files', '--others', '--exclude-standard', '-z']);
    const untracked = untrackedRaw.split('\0').filter(Boolean).sort();
    const hash = createHash('sha256').update(commit).update('\0').update(status).update('\0').update(diff);
    for (const relativePath of untracked) {
        const fullPath = resolve(root, relativePath);
        if (!isInside(root, fullPath) || !existsSync(fullPath) || !statSync(fullPath).isFile()) continue;
        hash.update('\0').update(relativePath.replaceAll('\\', '/')).update('\0').update(readFileSync(fullPath));
    }
    return {
        branch,
        commit,
        dirty: true,
        kind: 'working-tree',
        revision: `worktree-${hash.digest('hex').slice(0, 20)}`,
    };
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
    // Windows'ta geçici klasör veya dosya seçici 8.3 kısa-yol döndürebilir;
    // Git ise aynı kökü uzun Unicode yoluyla raporlar. İkisini native gerçek
    // yola çevirerek aynı depoyu yanlışlıkla alt klasör gibi reddetmeyiz.
    const root = realpathSync.native(resolve(input.path.trim()));
    if (!statSync(root).isDirectory()) throw new Error('Local repository path is not a directory.');
    const gitRoot = realpathSync.native(await git(root, ['rev-parse', '--show-toplevel']));
    if (gitRoot !== root) throw new Error(`Select the Git repository root: ${gitRoot}`);
    const localRevision = await readLocalRevision(root);
    const { branch, commit } = localRevision;
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
            revisionKind: localRevision.kind,
            revision: localRevision.revision,
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
