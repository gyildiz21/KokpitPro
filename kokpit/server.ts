import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProjectDiagram } from './diagram/diagram-service';
import { computeDelta } from './delta/compute';
import { DeltaHistoryStore } from './delta/history';
import { DeltaResult, type BaseRevision } from './delta/schema';
import { buildCompliance } from './check/index';
import { applyClosures, ComplianceClosureStore } from './check/closures';
import { ComplianceReport, ClosureRequest, type Violation } from './check/schema';
import {
    buildConflictEnvelope,
    buildCoverageEnvelope,
    buildDeltaEnvelope,
    buildSliceEnvelope,
    buildSyncEnvelope,
    buildViolationEnvelope,
    createExplainAiProvider,
    explainAiFallback,
    mergeAiExplanation,
    type AiMergeMeta,
    type ExplanationEnvelope,
    type ExplanationSubjectKind,
} from './explain';
import { GithubVerificationError, githubAuthConfiguration, indexGithubProject, type GithubProjectInput } from './projects/github';
import { indexLocalProject, refreshProjectFreshness, type LocalProjectInput } from './projects/local';
import { ProjectRegistry } from './projects/registry';
import type { ProjectRecord } from './projects/schema';
import { buildRemapReport } from './remap/service';
import { buildUiAssets, type UiAssets } from './ui/assets';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number.parseInt(process.env.PORT || '4173', 10);
const HOST = process.env.HOST || '127.0.0.1';
const KEEP_ALIVE_TIMEOUT_MS = 65_000;
const HEADERS_TIMEOUT_MS = 66_000;
const registry = new ProjectRegistry();
const deltaHistory = new DeltaHistoryStore(registry.dataDir);
const complianceClosures = new ComplianceClosureStore(registry.dataDir);
const MAX_BODY = 64 * 1024;
let uiAssets: UiAssets | null = null;

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
    constructor(readonly status: number, message: string, readonly code?: string, readonly retryAfter?: string) { super(message); }
}

/**
 * Dilim 2.1: GitHub doğrulama hataları ALGILANABİLİR durum koduyla taşınır;
 * anonim özel repo 404 olarak kalır (500'e gömülmez), UI dürüst yetki durumu
 * gösterir. Kod alanı makine sözleşmesidir; sır taşımaz.
 */
export function githubVerificationHttpStatus(error: GithubVerificationError): number {
    return error.status === 0 ? 502 : error.status;
}

function toHttpError(error: unknown): unknown {
    if (error instanceof GithubVerificationError) {
        return new HttpError(githubVerificationHttpStatus(error), error.message, `github-${error.reasonCode}`, error.retryAfter);
    }
    return error;
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

/**
 * Node 20'nin 5 saniyelik varsayılan keep-alive penceresi, yoğun ölçüm
 * sırasında bekleyen istemcinin kapanmış sokete POST göndermesine yol açabilir.
 * Başlık penceresini keep-alive'dan biraz uzun tutarak yarım kapanma yarışını
 * engelleriz; istek çalışma süresi sınırı Node'un ayrı requestTimeout'udur.
 */
export function configureHttpTransport(server: Server): Server {
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
    server.headersTimeout = HEADERS_TIMEOUT_MS;
    return server;
}

/**
 * Dilim 4: `/api/projects/:id/remap` rota eşleyicisi — saf ve testlenebilir
 * (isStaticPathBlocked deseni). Tam eşleşmede kodu çözülmüş proje kimliğini,
 * diğer tüm yollarda null döndürür.
 */
export function remapRouteProjectId(pathname: string): string | null {
    const remapMatch = /^\/api\/projects\/([^/]+)\/remap$/.exec(pathname);
    if (!remapMatch?.[1]) return null;
    try {
        return decodeURIComponent(remapMatch[1]);
    } catch {
        // Bozuk yüzde-kodlu istemci girdisi sunucu hatası değildir; rota
        // eşleşmemiş sayılır ve normal 404 akışına bırakılır.
        return null;
    }
}

const EXPLAIN_KINDS: readonly ExplanationSubjectKind[] = ['violation', 'sync', 'conflict', 'coverage', 'plan-slice', 'delta-item'];

/**
 * Dilim 5.2: `/api/projects/:id/explain` sorgu çözümleyicisi — saf ve
 * testlenebilir (remapRouteProjectId deseni). Geçerli kind + zorunlu id
 * (delta-item için ek phase+item) dışındaki her isteği reddeder.
 */
export function explainRouteQuery(url: URL): { kind: ExplanationSubjectKind; id: string; phase: string | null; item: string | null } | null {
    const kind = url.searchParams.get('kind');
    if (!kind || !EXPLAIN_KINDS.includes(kind as ExplanationSubjectKind)) return null;
    const id = (url.searchParams.get('id') ?? '').trim();
    if (!id && kind !== 'coverage') return null;
    const phase = url.searchParams.get('phase');
    const item = url.searchParams.get('item');
    if (kind === 'delta-item' && (!phase || !item)) return null;
    return { kind: kind as ExplanationSubjectKind, id, phase, item };
}

/**
 * Plan bölümündeki ilk "Kabul" satırını sade metin olarak çıkarır. Markdown
 * süsü atılır; kabul cümlesi yoksa null döner — uydurulmaz (DESIGN D2#3).
 */
export function sliceAcceptanceText(planMarkdown: string, heading: string): string | null {
    const lines = planMarkdown.split(/\r?\n/);
    const headingIndex = lines.findIndex((line) => /^#{1,6}\s+/.test(line) && (line.replace(/^#{1,6}\s+/, '').trim() === heading.trim()));
    if (headingIndex < 0) return null;
    const headingLevel = (/^#{1,6}\s/.exec(lines[headingIndex] ?? '')?.[0] ?? '# ').length - 1;
    for (let index = headingIndex + 1; index < lines.length; index += 1) {
        const line = lines[index] ?? '';
        const nextHeading = /^#{1,6}\s+/.exec(line);
        if (nextHeading && (nextHeading[0]?.length ?? 1) - 1 <= headingLevel) break;
        // Yalnız gerçek "Kabul:" etiket satırı kabul metnidir; "kabul" sözcüğünü
        // içeren checkbox maddeleri (ör. "- [ ] **Kabul:** ...") kabul DEĞİLDİR.
        const label = /^\s*(?:-\s*)?(?:\*\*)?\s*Kabul\s*:\s*(?:\*\*)?\s*(.*)$/i.exec(line);
        if (!label) continue;
        const parts = [label[1] ?? ''];
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
            const continuation = lines[cursor] ?? '';
            if (!/^\s{2,}\S/.test(continuation) || /^\s*-\s/.test(continuation)) break;
            parts.push(continuation.trim());
        }
        const text = parts.join(' ').replace(/\*\*/g, '').trim();
        if (!text) continue;
        return text.length > 600 ? `${text.slice(0, 597)}…` : text;
    }
    return null;
}

export interface ExplainBuildDeps {
    report?: ComplianceReport;
    delta?: DeltaResult;
    provider?: ReturnType<typeof createExplainAiProvider>;
    now?: () => Date;
}

/**
 * Dilim 5.2 açıklama projection'ı: ComplianceReport / DeltaResult / plan
 * grupları gibi ölçülmüş gerçekleri tüketir, ExplanationEnvelope v1 üretir
 * ve varsa yapılandırılmış AI sağlayıcısının önerisini ayrı katman olarak
 * birleştirir (hatada deterministik zarf korunur). Ölçülen girdiler asla
 * değiştirilmez; zarf hiçbir ciddiyeti/durumu/sayacı alterne edemez.
 */
export async function buildProjectExplain(
    project: ProjectRecord,
    query: { kind: ExplanationSubjectKind; id: string; phase: string | null; item: string | null },
    deps: ExplainBuildDeps = {},
): Promise<ExplanationEnvelope> {
    const sourceRevision = project.index.revision ?? project.index.commit ?? project.index.indexedAt ?? 'unindexed';
    const envelope = await buildDeterministicExplain(project, query, deps, sourceRevision);
    const provider = deps.provider !== undefined ? deps.provider : createExplainAiProvider(process.env);
    if (!provider) return envelope;
    const generatedAt = (deps.now ?? (() => new Date()))().toISOString();
    const meta: AiMergeMeta = { provider: provider.id, model: provider.model, sourceRevision: envelope.sourceRevision, generatedAt };
    try {
        const proposal = await provider.generate({
            projectId: envelope.projectId,
            sourceRevision: envelope.sourceRevision,
            subjectKind: envelope.subjectKind,
            subjectId: envelope.subjectId,
            measured: envelope,
        });
        return mergeAiExplanation(envelope, proposal, meta);
    } catch {
        // Sağlayıcı hatası deterministik açıklamayı bozmaz; teknik hata
        // kullanıcı kanıtı gibi taşınmaz (DESIGN D8.4).
        return explainAiFallback(new Error('explain-ai-provider-failed'), envelope);
    }
}

async function buildDeterministicExplain(
    project: ProjectRecord,
    query: { kind: ExplanationSubjectKind; id: string; phase: string | null; item: string | null },
    deps: ExplainBuildDeps,
    sourceRevision: string,
): Promise<ExplanationEnvelope> {
    if (query.kind === 'delta-item') {
        const delta = deps.delta ?? await buildProjectDelta(project, query.phase as string, query.item as string);
        return buildDeltaEnvelope(delta, { projectId: project.id, sourceRevision: delta.baseRevision.revision ?? sourceRevision });
    }
    if (query.kind === 'plan-slice') {
        const match = /^Dilim-([0-9]+(?:\.[0-9]+)?)$/.exec(query.id);
        const heading = project.index.groups.find((group) => {
            // Kimlik "Dilim-5.2" biçimindeyse başlık metniyle eşle; değilse doğrudan başlık ara.
            // Sürüm öneki kısmi eşleşemez: "Dilim-5" isteği "Dilim 5.2" başlığıyla eşleşmez.
            if (!match?.[1]) return group.heading === query.id;
            return new RegExp(`^Dilim\\s+${match[1].replace('.', '\\.')}(?![0-9.])`).test(group.heading);
        });
        if (!heading) throw new HttpError(404, `Plan slice not found: ${query.id}`);
        const counts = { done: 0, partial: 0, open: 0, blocked: 0 };
        for (const item of heading.items) {
            if (item.status === 'done') counts.done += 1;
            else if (item.status === 'partial') counts.partial += 1;
            else counts.open += 1;
        }
        const acceptance = sliceAcceptanceText(project.index.planMarkdown, heading.heading);
        return buildSliceEnvelope({
            projectId: project.id,
            sourceRevision,
            phaseId: query.id,
            heading: heading.heading,
            counts,
            acceptanceText: acceptance ? { tr: acceptance, en: acceptance } : undefined,
        });
    }
    const report = deps.report ?? applyClosures(await buildCompliance(project), complianceClosures.list(project.id));
    if (query.kind === 'coverage') return buildCoverageEnvelope(report);
    if (query.kind === 'violation') {
        const violation: Violation | undefined = report.violations.find((candidate) => candidate.id === query.id);
        if (!violation) throw new HttpError(404, `Violation not found: ${query.id}`);
        return buildViolationEnvelope(report, violation);
    }
    if (query.kind === 'sync') {
        const entry = report.sync.find((candidate) => candidate.sliceId === query.id);
        if (!entry) throw new HttpError(404, `Sync record not found: ${query.id}`);
        return buildSyncEnvelope(report, entry);
    }
    const conflict = report.conflicts.find((candidate) => candidate.id === query.id);
    if (!conflict) throw new HttpError(404, `Conflict not found: ${query.id}`);
    return buildConflictEnvelope(report, conflict);
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

function diagramInputFor(project: ProjectRecord) {
    return {
        projectId: project.id,
        sourceRoot: project.source.type === 'local' ? project.source.root : undefined,
        remoteUrl:
            project.source.type === 'local'
                ? project.source.remoteUrl
                : `https://github.com/${project.source.owner}/${project.source.repo}`,
        branch: project.index.branch,
        commit: project.index.commit,
        revisionKind: project.index.revisionKind,
        revision: project.index.revision,
        verifyLocalRevision: project.source.type === 'local',
        groups: project.index.groups,
    };
}

function receiptBaseRevision(project: ProjectRecord): BaseRevision {
    const kind = project.index.revisionKind ?? 'commit';
    const revision = project.index.revision ?? project.index.commit;
    return { kind, revision, commit: project.index.commit, branch: project.index.branch };
}

async function registryWithLiveFreshness() {
    const current = registry.read();
    return {
        ...current,
        projects: await Promise.all(current.projects.map(refreshProjectFreshness)),
    };
}

async function recordDiagramSnapshot(project: ProjectRecord): Promise<void> {
    if (project.source.type !== 'local') return;
    const diagram = await buildProjectDiagram(diagramInputFor(project));
    if (!diagram.measurable) return;
    deltaHistory.record(
        project.id,
        project.index.revision ?? project.index.commit,
        diagram.receipt.graph,
    );
}

/**
 * Dilim 3 delta hesabı. Ölçüm aynı diyagram disipliniyle (canlı makbuz
 * doğrulaması) alınır; ölçülemez durumlar sahte boş başarı olarak GİZLENMEZ.
 */
async function buildProjectDelta(project: ProjectRecord, phaseHeading: string, itemKey: string) {
    const receipt = {
        branch: project.index.branch,
        commit: project.index.commit,
        revisionKind: project.index.revisionKind,
        revision: project.index.revision,
        groups: project.index.groups,
    };
    if (project.source.type !== 'local') {
        return computeDelta({
            projectId: project.id, phaseHeading, itemKey,
            receipt, diagram: null, liveRevision: null,
        });
    }
    const basis = await buildProjectDiagram(diagramInputFor(project));
    if (basis.measurable) {
        // verifyLocalRevision:true tazeliği kanıtladı → canlı == temel revizyon.
        return computeDelta({
            projectId: project.id, phaseHeading, itemKey,
            receipt,
            diagram: basis.receipt,
            liveRevision: receiptBaseRevision(project),
            baselineDiagram: deltaHistory.baselineFor(
                project.id,
                project.index.revision ?? project.index.commit,
            ),
        });
    }
    if (basis.reason === 'stale-receipt' && basis.currentRevision) {
        const current = basis.currentRevision;
        return computeDelta({
            projectId: project.id, phaseHeading, itemKey,
            receipt, diagram: null,
            liveRevision: { kind: current.kind, revision: current.revision, commit: current.commit, branch: current.branch },
        });
    }
    // Diğer ölçülememe nedenleri dürüst sözleşmeyle taşınır; sahte içerik yok.
    return DeltaResult.parse({
        schemaVersion: 1,
        projectId: project.id,
        itemId: `${phaseHeading}::${itemKey}`,
        phaseHeading,
        mode: 'unmeasurable',
        baseRevision: receiptBaseRevision(project),
        declaredPaths: [],
        affectedNodeIds: [],
        affectedPaths: [],
        affectedTests: [],
        proposedNodes: [],
        addedEdges: [],
        removedEdges: [],
        evidenceKind: 'none',
        reasons: [{ code: 'no-mapping', message: `delta-basis-unavailable:${basis.reason}` }],
        durationMs: 0,
    });
}

async function reindex(project: ProjectRecord): Promise<ProjectRecord> {
    try {
        const updated = project.source.type === 'local'
            ? await indexLocalProject({ path: project.source.root, planPath: project.index.planPath, name: project.name }, project)
            : await indexGithubProject({ repository: `${project.source.owner}/${project.source.repo}`, branch: project.branch, planPath: project.index.planPath, name: project.name }, project);
        registry.upsert(updated);
        await recordDiagramSnapshot(updated);
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
        json(response, 200, await registryWithLiveFreshness());
        return true;
    }
    const planMatch = /^\/api\/projects\/([^/]+)\/plan$/.exec(url.pathname);
    if (request.method === 'GET' && planMatch?.[1]) {
        const project = findProject(decodeURIComponent(planMatch[1]));
        response.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(project.index.planMarkdown);
        return true;
    }
    // Dilim 2: gerçek import-grafından ölçümlü diyagram. Yerel kökü olmayan
    // kaynakta measurable:false döner — tahmin üretilmez.
    const diagramMatch = /^\/api\/projects\/([^/]+)\/diagram$/.exec(url.pathname);
    if (request.method === 'GET' && diagramMatch?.[1]) {
        const project = findProject(decodeURIComponent(diagramMatch[1]));
        const diagram = await buildProjectDiagram(diagramInputFor(project));
        if (diagram.measurable) {
            deltaHistory.record(
                project.id,
                project.index.revision ?? project.index.commit,
                diagram.receipt.graph,
            );
        }
        json(response, 200, diagram);
        return true;
    }
    // Dilim 3: seçili bileşik plan maddesinin kanıta dayalı delta ön-görünümü.
    // Bayat makbuz HTTP hatası DEĞİLDİR: 200 + mode:'unmeasurable' +
    // code:'stale-receipt' döner; UI yeniden indeks eylemi sunar.
    const deltaMatch = /^\/api\/projects\/([^/]+)\/delta$/.exec(url.pathname);
    if (request.method === 'GET' && deltaMatch?.[1]) {
        const project = findProject(decodeURIComponent(deltaMatch[1]));
        const phase = url.searchParams.get('phase');
        const item = url.searchParams.get('item');
        if (!phase || !item) throw new HttpError(400, 'phase and item query parameters are required.');
        json(response, 200, { delta: await buildProjectDelta(project, phase, item) });
        return true;
    }
    // Dilim 5: canlı uyum raporu. cache:no-store; her çağrı canlı hesaplar ve
    // kapatma denetim kayıtlarını uygular. Kapatılmış ihlaller aktif sağlık
    // bantlarına sayılmaz; "Gerekçeyle kapalı" kuyruğuna düşer.
    const complianceMatch = /^\/api\/projects\/([^/]+)\/compliance$/.exec(url.pathname);
    if (request.method === 'GET' && complianceMatch?.[1]) {
        const project = findProject(decodeURIComponent(complianceMatch[1]));
        const report = await buildCompliance(project);
        json(response, 200, { report: applyClosures(report, complianceClosures.list(project.id)) });
        return true;
    }
    const complianceCloseMatch = /^\/api\/projects\/([^/]+)\/compliance\/close$/.exec(url.pathname);
    if (request.method === 'POST' && complianceCloseMatch?.[1]) {
        const project = findProject(decodeURIComponent(complianceCloseMatch[1]));
        let input: ClosureRequest;
        try {
            input = ClosureRequest.parse(await body(request));
        } catch {
            throw new HttpError(400, 'violationId, justification and by are required; justification cannot be empty.');
        }
        const report = await buildCompliance(project);
        const violation = report.violations.find((candidate) => candidate.id === input.violationId);
        if (!violation) throw new HttpError(404, `Violation not found: ${input.violationId}`);
        if (violation.state === 'closed' || complianceClosures.list(project.id).some((closure) => closure.violationId === input.violationId)) {
            throw new HttpError(409, `Violation is already closed: ${input.violationId}`);
        }
        complianceClosures.add({
            projectId: project.id,
            sourceRevision: report.sourceRevision,
            violationId: violation.id,
            closedAt: new Date().toISOString(),
            closedBy: input.by,
            justification: input.justification,
            rule: violation.rule,
            targetPath: violation.targetPath,
            severity: violation.severity,
        });
        json(response, 200, { report: applyClosures(report, complianceClosures.list(project.id)) });
        return true;
    }
    // Dilim 5.2: açıklama katmanı. ComplianceReport / Delta / plan grupları gibi
    // ölçülmüş gerçekleri tüketen ayrı projection'dır; ölçüm sözleşmelerini
    // değiştirmez. AI yapılandırılmışsa (opt-in) öneri ayrı katman olarak
    // birleştirilir; sağlayıcı hatasında deterministik zarf korunur.
    const explainMatch = /^\/api\/projects\/([^/]+)\/explain$/.exec(url.pathname);
    if (request.method === 'GET' && explainMatch?.[1]) {
        const project = findProject(decodeURIComponent(explainMatch[1]));
        const query = explainRouteQuery(url);
        if (!query) throw new HttpError(400, 'kind must be one of violation|sync|conflict|coverage|plan-slice|delta-item; id is required (phase and item for delta-item).');
        json(response, 200, { envelope: await buildProjectExplain(project, query) });
        return true;
    }
    // Dilim 4: kanıta dayalı remap önerileri. Ölçüm canlı yerel çalışma
    // ağacında yapılır; bayat makbuz ve yerel checkout yokluğu HTTP hatası
    // DEĞİLDİR: 200 + measurement:'unmeasurable' + neden kodları döner;
    // ölçülemez durum sahte boş başarıyla GİZLENMEZ.
    const remapProjectId = request.method === 'GET' ? remapRouteProjectId(url.pathname) : null;
    if (remapProjectId) {
        const project = findProject(remapProjectId); // bilinmeyen kimlik → 404
        json(response, 200, { report: await buildRemapReport(project) });
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
        const stored = registry.upsert(project, !registry.read().activeProjectId);
        await recordDiagramSnapshot(project);
        json(response, 201, stored);
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
        const projectId = decodeURIComponent(deleteMatch[1]);
        const updated = registry.remove(projectId);
        deltaHistory.remove(projectId);
        complianceClosures.remove(projectId);
        json(response, 200, updated);
        return true;
    }
    throw new HttpError(404, 'API route not found.');
}

function serveStatic(request: IncomingMessage, response: ServerResponse, url: URL): void {
    const pathname = decodeURIComponent(url.pathname === '/' ? '/arayuz-onizleme.html' : url.pathname);
    if (pathname === '/assets/map-flow.js' || pathname === '/assets/map-flow.css') {
        if (!uiAssets) throw new HttpError(503, 'UI assets are not ready.');
        const javascript = pathname.endsWith('.js');
        const content = javascript ? uiAssets.mapFlowJs : uiAssets.mapFlowCss;
        response.writeHead(200, {
            'Content-Type': javascript ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8',
            'Cache-Control': 'no-store',
        });
        response.end(request.method === 'HEAD' ? undefined : content);
        return;
    }
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
    await recordDiagramSnapshot(current);
}

export async function startServer(): Promise<void> {
    uiAssets = await buildUiAssets(ROOT);
    await bootstrap();
    // K1: Host header doğrulaması — DNS-rebinding'e karşı (auditi §1.5).
    const server = configureHttpTransport(createServer(async (request, response) => {
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
            const mapped = toHttpError(error);
            const status = mapped instanceof HttpError ? mapped.status : 500;
            const code = mapped instanceof HttpError ? mapped.code : undefined;
            const retryAfter = mapped instanceof HttpError ? mapped.retryAfter : undefined;
            json(response, status, {
                error: mapped instanceof Error ? mapped.message : String(mapped),
                ...(code ? { code } : {}),
                ...(retryAfter ? { retryAfter } : {}),
            });
        }
    }));
    server.listen(PORT, HOST, () => {
        console.log(`KokpitPro ready: http://${HOST}:${PORT}/arayuz-onizleme.html`);
        console.log(`Registry: ${registry.filePath}`);
    });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    startServer().catch((error) => { console.error(error); process.exitCode = 1; });
}
