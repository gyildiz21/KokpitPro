import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { githubAuthConfiguration, indexGithubProject, type GithubProjectInput } from './projects/github';
import { indexLocalProject, type LocalProjectInput } from './projects/local';
import { ProjectRegistry } from './projects/registry';
import type { ProjectRecord } from './projects/schema';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number.parseInt(process.env.PORT || '4173', 10);
const HOST = process.env.HOST || '127.0.0.1';
const registry = new ProjectRegistry();
const MAX_BODY = 64 * 1024;

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

class HttpError extends Error {
    constructor(readonly status: number, message: string) { super(message); }
}

export function isStaticPathBlocked(pathname: string): boolean {
    const envSegment = /(^|\/)\.env(\.|$)/.test(pathname);
    return pathname.includes('\0')
        || pathname.startsWith('/.git')
        || pathname.startsWith('/.kokpit')
        || pathname.startsWith('/node_modules')
        || pathname === '/gitdiagram'
        || pathname.startsWith('/gitdiagram/')
        || envSegment;
}

export function isAllowedHostHeader(
    hostHeader: string | undefined,
    configuredHost = HOST,
    configuredPort = PORT,
): boolean {
    const normalized = (hostHeader || '').trim().toLowerCase();
    const allowed = new Set([
        `${configuredHost.toLowerCase()}:${configuredPort}`,
        `127.0.0.1:${configuredPort}`,
        `localhost:${configuredPort}`,
    ]);
    return allowed.has(normalized);
}

function json(response: ServerResponse, status: number, payload: unknown): void {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(payload));
}

async function body<T>(request: IncomingMessage): Promise<T> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_BODY) throw new HttpError(413, 'Request body is too large.');
        chunks.push(buffer);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T; }
    catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
}

function assertSameOrigin(request: IncomingMessage): void {
    const origin = request.headers.origin;
    if (!origin) return;
    const allowed = new Set([`http://${HOST}:${PORT}`, `http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
    if (!allowed.has(origin)) throw new HttpError(403, 'Cross-origin mutations are not allowed.');
}

function findProject(id: string): ProjectRecord {
    const project = registry.read().projects.find((candidate) => candidate.id === id);
    if (!project) throw new HttpError(404, `Project not found: ${id}`);
    return project;
}

async function reindex(project: ProjectRecord): Promise<ProjectRecord> {
    try {
        const updated = project.source.type === 'local'
            ? await indexLocalProject({ path: project.source.root, planPath: project.index.planPath, name: project.name }, project)
            : await indexGithubProject({ repository: `${project.source.owner}/${project.source.repo}`, branch: project.branch, planPath: project.index.planPath, name: project.name }, project);
        registry.upsert(updated);
        return updated;
    } catch (error) {
        const stale = { ...project, connectionState: 'stale' as const, updatedAt: new Date().toISOString(), lastError: error instanceof Error ? error.message : String(error) };
        registry.upsert(stale);
        throw error;
    }
}

async function api(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
    if (!url.pathname.startsWith('/api/')) return false;
    if (request.method !== 'GET' && request.method !== 'HEAD') assertSameOrigin(request);

    if (request.method === 'GET' && url.pathname === '/api/health') {
        json(response, 200, { ok: true, persistence: registry.filePath, github: githubAuthConfiguration() });
        return true;
    }
    if (request.method === 'GET' && url.pathname === '/api/projects') {
        json(response, 200, registry.read());
        return true;
    }
    const planMatch = /^\/api\/projects\/([^/]+)\/plan$/.exec(url.pathname);
    if (request.method === 'GET' && planMatch?.[1]) {
        const project = findProject(decodeURIComponent(planMatch[1]));
        response.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(project.index.planMarkdown);
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/projects/verify/local') {
        json(response, 200, await indexLocalProject(await body<LocalProjectInput>(request)));
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/projects/verify/github') {
        json(response, 200, await indexGithubProject(await body<GithubProjectInput>(request)));
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/projects/local') {
        const project = await indexLocalProject(await body<LocalProjectInput>(request));
        json(response, 201, registry.upsert(project, !registry.read().activeProjectId));
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/projects/github') {
        const project = await indexGithubProject(await body<GithubProjectInput>(request));
        json(response, 201, registry.upsert(project, !registry.read().activeProjectId));
        return true;
    }
    if (request.method === 'PUT' && url.pathname === '/api/projects/active') {
        const input = await body<{ projectId?: string }>(request);
        if (!input.projectId) throw new HttpError(400, 'projectId is required.');
        json(response, 200, registry.setActive(input.projectId));
        return true;
    }
    const reindexMatch = /^\/api\/projects\/([^/]+)\/reindex$/.exec(url.pathname);
    if (request.method === 'POST' && reindexMatch?.[1]) {
        json(response, 200, await reindex(findProject(decodeURIComponent(reindexMatch[1]))));
        return true;
    }
    const deleteMatch = /^\/api\/projects\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'DELETE' && deleteMatch?.[1]) {
        json(response, 200, registry.remove(decodeURIComponent(deleteMatch[1])));
        return true;
    }
    throw new HttpError(404, 'API route not found.');
}

function serveStatic(request: IncomingMessage, response: ServerResponse, url: URL): void {
    const pathname = decodeURIComponent(url.pathname === '/' ? '/arayuz-onizleme.html' : url.pathname);
    // K1 güvenlik yaması (hazirlik-auditi §1.5): gizli anahtar/bağımlılık ağaçları
    // asla servis edilmez. Referans motorun .env dosyası da bu sınıra dahildir.
    if (isStaticPathBlocked(pathname)) throw new HttpError(404, 'Not found.');
    const path = resolve(ROOT, `.${pathname}`);
    const rel = relative(ROOT, path);
    if (rel === '..' || rel.startsWith(`..${sep}`)) throw new HttpError(403, 'Path is outside the application root.');
    if (!existsSync(path) || !statSync(path).isFile()) throw new HttpError(404, 'Not found.');
    response.writeHead(200, { 'Content-Type': MIME[extname(path).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (request.method === 'HEAD') response.end(); else createReadStream(path).pipe(response);
}

async function bootstrap(): Promise<void> {
    if (registry.read().projects.length) return;
    const current = await indexLocalProject({ path: ROOT, planPath: 'PLAN.md', name: 'KokpitPro' });
    registry.upsert(current, true);
}

export async function startServer(): Promise<void> {
    await bootstrap();
    // K1: Host header doğrulaması — DNS-rebinding'e karşı (auditi §1.5).
    const server = createServer(async (request, response) => {
        try {
            const hostHeader = (request.headers.host || '').trim().toLowerCase();
            if (!isAllowedHostHeader(hostHeader)) {
                throw new HttpError(403, 'Forbidden host.');
            }
            const url = new URL(request.url || '/', `http://${hostHeader}`);
            if (await api(request, response, url)) return;
            if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
            serveStatic(request, response, url);
        } catch (error) {
            const status = error instanceof HttpError ? error.status : 500;
            json(response, status, { error: error instanceof Error ? error.message : String(error) });
        }
    });
    server.listen(PORT, HOST, () => {
        console.log(`KokpitPro ready: http://${HOST}:${PORT}/arayuz-onizleme.html`);
        console.log(`Registry: ${registry.filePath}`);
    });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    startServer().catch((error) => { console.error(error); process.exitCode = 1; });
}
