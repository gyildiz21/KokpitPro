import { createHash, createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { ProjectRecord, type ProjectNode, type ProjectRecord as ProjectRecordType } from './schema';
import { indexPlanText } from './plan';

const API_ROOT = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const PLAN_CANDIDATES = ['PLAN.md', 'ROADMAP.md', 'DEVIR_TESLIM.md', 'docs/PLAN.md', 'docs/ROADMAP.md'];

interface GithubAuth {
    mode: 'github-app' | 'server-token' | 'anonymous';
    token: string | null;
}

interface GithubRepositoryResponse {
    name: string;
    default_branch: string;
    html_url: string;
    private: boolean;
}

interface GithubCommitResponse { sha: string }
interface GithubContentEntry { name: string; path: string; type: 'file' | 'dir' | string }
interface GithubInstallationToken { token: string; expires_at: string }

const installationTokenCache = new Map<string, { token: string; expiresAt: number }>();

function base64url(value: string): string {
    return Buffer.from(value).toString('base64url');
}

function githubAppPrivateKey(): string | null {
    const inline = process.env.GITHUB_APP_PRIVATE_KEY?.replaceAll('\\n', '\n');
    if (inline) return inline;
    const path = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    return path && existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function githubAppJwt(): string | null {
    const appId = process.env.GITHUB_APP_ID;
    const key = githubAppPrivateKey();
    if (!appId || !key) return null;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }))}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    return `${unsigned}.${signer.sign(key).toString('base64url')}`;
}

function githubHeaders(token: string | null, accept = 'application/vnd.github+json'): Record<string, string> {
    return {
        Accept: accept,
        'X-GitHub-Api-Version': API_VERSION,
        'User-Agent': 'KokpitPro/0.1',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function githubAppInstallationToken(repo: string): Promise<string | null> {
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    const jwt = githubAppJwt();
    if (!installationId || !jwt) return null;
    const cached = installationTokenCache.get(repo);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const response = await fetch(`${API_ROOT}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
        method: 'POST',
        headers: githubHeaders(jwt),
        body: JSON.stringify({ repositories: [repo], permissions: { contents: 'read' } }),
    });
    if (!response.ok) throw new Error(`GitHub App token request failed (${response.status}): ${await response.text()}`);
    const payload = (await response.json()) as GithubInstallationToken;
    installationTokenCache.set(repo, { token: payload.token, expiresAt: Date.parse(payload.expires_at) });
    return payload.token;
}

async function resolveAuth(repo: string): Promise<GithubAuth> {
    const appToken = await githubAppInstallationToken(repo);
    if (appToken) return { mode: 'github-app', token: appToken };
    if (process.env.GITHUB_TOKEN) return { mode: 'server-token', token: process.env.GITHUB_TOKEN };
    return { mode: 'anonymous', token: null };
}

async function githubJson<T>(path: string, token: string | null): Promise<T> {
    const response = await fetch(`${API_ROOT}${path}`, { headers: githubHeaders(token) });
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
    return (await response.json()) as T;
}

async function githubRaw(path: string, token: string | null): Promise<string> {
    const response = await fetch(`${API_ROOT}${path}`, { headers: githubHeaders(token, 'application/vnd.github.raw+json') });
    if (!response.ok) throw new Error(`GitHub contents ${response.status}: ${await response.text()}`);
    const text = await response.text();
    if (text.length > 2 * 1024 * 1024) throw new Error('Plan file is larger than 2 MiB.');
    return text;
}

export function parseGithubRepository(input: string): { owner: string; repo: string } {
    const trimmed = input.trim().replace(/\.git$/i, '').replace(/\/+$/, '');
    const normalized = trimmed.replace(/^https?:\/\/github\.com\//i, '').replace(/^git@github\.com:/i, '');
    const [owner, repo, ...extra] = normalized.split('/').filter(Boolean);
    if (!owner || !repo || extra.length) throw new Error('GitHub repository must be owner/repo or a github.com URL.');
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Invalid GitHub repository identifier.');
    return { owner, repo };
}

async function discoverPlan(owner: string, repo: string, branch: string, token: string | null, requested?: string) {
    const candidates = requested && requested !== 'auto' ? [requested] : PLAN_CANDIDATES;
    for (const candidate of candidates) {
        try {
            const encodedPath = candidate.split('/').map(encodeURIComponent).join('/');
            const markdown = await githubRaw(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, token);
            return { planPath: candidate, planMarkdown: markdown };
        } catch (error) {
            if (!String(error).includes(' 404:')) throw error;
        }
    }
    throw new Error(`No readable plan file found. Tried: ${candidates.join(', ')}`);
}

function nodesOf(entries: GithubContentEntry[], owner: string, repo: string, branch: string): ProjectNode[] {
    const preferred = ['src', 'app', 'frontend', 'backend', 'functions', 'services', 'packages'];
    return entries
        .filter((entry) => entry.type === 'dir' || /\.(?:ts|tsx|js|jsx|py|go|rs)$/i.test(entry.name))
        .sort((a, b) => {
            const ai = preferred.indexOf(a.name);
            const bi = preferred.indexOf(b.name);
            if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
            return a.name.localeCompare(b.name);
        })
        .slice(0, 5)
        .map((entry) => ({
            id: createHash('sha1').update(entry.path).digest('hex').slice(0, 10),
            title: entry.type === 'dir' ? `${entry.name}/` : entry.name,
            path: entry.path,
            kind: entry.type === 'dir' ? 'directory' : 'file',
            status: 'done',
            evidence: `Verified through GitHub Contents API: https://github.com/${owner}/${repo}/tree/${branch}/${entry.path}`,
        }));
}

export interface GithubProjectInput {
    repository: string;
    branch?: string;
    planPath?: string;
    name?: string;
}

export async function indexGithubProject(input: GithubProjectInput, previous?: ProjectRecordType): Promise<ProjectRecordType> {
    const { owner, repo } = parseGithubRepository(input.repository);
    const auth = await resolveAuth(repo);
    const repository = await githubJson<GithubRepositoryResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, auth.token);
    const branch = input.branch?.trim() || repository.default_branch;
    const commit = await githubJson<GithubCommitResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(branch)}`, auth.token);
    const plan = await discoverPlan(owner, repo, branch, auth.token, input.planPath);
    const planIndex = indexPlanText(plan.planMarkdown, plan.planPath);
    const rootEntries = await githubJson<GithubContentEntry[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents?ref=${encodeURIComponent(branch)}`, auth.token);
    const now = new Date().toISOString();
    const identity = `${owner}/${repo}`.toLocaleLowerCase('en-US');
    const id = previous?.id ?? `github-${createHash('sha256').update(identity).digest('hex').slice(0, 12)}`;
    return ProjectRecord.parse({
        id,
        name: input.name?.trim() || previous?.name || repository.name,
        source: { type: 'github', owner, repo, htmlUrl: repository.html_url, private: repository.private },
        branch,
        authMode: auth.mode,
        connectionState: 'ready',
        index: {
            indexedAt: now,
            commit: commit.sha,
            branch,
            planPath: plan.planPath,
            planMarkdown: plan.planMarkdown,
            groups: planIndex.groups,
            summary: planIndex.summary,
            nodes: nodesOf(rootEntries, owner, repo, branch),
        },
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        lastError: null,
    });
}

export function githubAuthConfiguration(): { mode: string; configured: boolean } {
    const appConfigured = Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_INSTALLATION_ID && githubAppPrivateKey());
    if (appConfigured) return { mode: 'github-app', configured: true };
    if (process.env.GITHUB_TOKEN) return { mode: 'server-token', configured: true };
    return { mode: 'anonymous-public-only', configured: false };
}
