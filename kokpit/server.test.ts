import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ComplianceReport } from './check/schema';
import { createExplainAiProvider, ExplanationEnvelope } from './explain';
import { GithubVerificationError } from './projects/github';
import type { ProjectRecord } from './projects/schema';
import { buildProjectExplain, configureHttpTransport, explainRouteQuery, githubVerificationHttpStatus, isAllowedHostHeader, isStaticPathBlocked, remapRouteProjectId, sliceAcceptanceText } from './server';

describe('local server security boundaries', () => {
    it('blocks secret, registry, dependency, and reference-engine paths', () => {
        for (const path of [
            '/.env',
            '/.env.local',
            '/nested/.env.production',
            '/.git/config',
            '/.kokpit/data/projects.json',
            '/node_modules/zod/index.js',
            '/gitdiagram',
            '/gitdiagram/.env',
        ]) {
            expect(isStaticPathBlocked(path), path).toBe(true);
        }
        expect(isStaticPathBlocked('/arayuz-onizleme.html')).toBe(false);
        expect(isStaticPathBlocked('/docs/environment.md')).toBe(false);
    });

    it('accepts only the configured local host aliases and exact port', () => {
        expect(isAllowedHostHeader('127.0.0.1:4173')).toBe(true);
        expect(isAllowedHostHeader('LOCALHOST:4173')).toBe(true);
        expect(isAllowedHostHeader('0.0.0.0:4173', '0.0.0.0', 4173)).toBe(true);
        expect(isAllowedHostHeader('attacker.example:4173')).toBe(false);
        expect(isAllowedHostHeader('localhost:4174')).toBe(false);
        expect(isAllowedHostHeader(undefined)).toBe(false);
    });

    it('keeps idle HTTP connections alive through long measurement requests', () => {
        const server = configureHttpTransport(createServer());
        expect(server.keepAliveTimeout).toBe(65_000);
        expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
    });

    it('maps GitHub network failures to a valid gateway status and preserves valid upstream classes', () => {
        expect(githubVerificationHttpStatus(new GithubVerificationError(0, 'network', 'offline'))).toBe(502);
        expect(githubVerificationHttpStatus(new GithubVerificationError(404, 'not-found-or-private', 'missing'))).toBe(404);
        expect(githubVerificationHttpStatus(new GithubVerificationError(429, 'rate-limit', 'later', '60'))).toBe(429);
    });

    it('remap rotası yalnız tam eşleşmede kodu çözülmüş proje kimliğini çözer', () => {
        expect(remapRouteProjectId('/api/projects/p-1/remap')).toBe('p-1');
        expect(remapRouteProjectId('/api/projects/proje%20ad%C4%B1/remap')).toBe('proje adı');
        expect(remapRouteProjectId('/api/projects/p-1/diagram')).toBeNull();
        expect(remapRouteProjectId('/api/projects/p-1/remap/ekstra')).toBeNull();
        expect(remapRouteProjectId('/api/projects//remap')).toBeNull();
        expect(remapRouteProjectId('/api/projects/%E0%A4%A/remap')).toBeNull();
    });
});

describe('dilim 5.2 explain yüzeyi', () => {
    const PLAN = [
        '# Plan',
        '',
        '## Dilim 5 · Uyum Telemetrisi',
        '',
        '- [x] şema',
        '- [ ] kabul',
        '',
        '## Dilim 5.2 · Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit',
        '',
        '> sözleşme',
        '',
        '- [x] **5.2.0 — sözleşme:** donduruldu',
        '- [ ] **5.2.6 — kabul:** gerçek korpus ölçümü',
        '- **Kabul:** doğrulanmış bir karar/otorite çifti insanca onaylanmalı.',
        '',
    ].join('\n');

    function projectFixture(): ProjectRecord {
        return {
            id: 'local-test',
            name: 'Test',
            source: { type: 'local', root: 'C:/mock' },
            authMode: 'local',
            branch: 'main',
            connectionState: 'ready',
            lastError: null,
            index: {
                planPath: 'PLAN.md',
                planMarkdown: PLAN,
                commit: 'a'.repeat(40),
                revisionKind: 'commit',
                revision: 'b'.repeat(40),
                indexedAt: '2026-08-31T00:00:00.000Z',
                summary: { phaseCount: 2, itemCount: 4 },
                groups: [
                    {
                        heading: 'Dilim 5 · Uyum Telemetrisi',
                        gateStatus: null,
                        line: 3,
                        items: [
                            { id: 'madde-1', title: 'şema', status: 'done', phaseHeading: 'Dilim 5 · Uyum Telemetrisi', line: 5 },
                            { id: 'madde-2', title: 'kabul', status: 'open', phaseHeading: 'Dilim 5 · Uyum Telemetrisi', line: 6 },
                        ],
                    },
                    {
                        heading: 'Dilim 5.2 · Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit',
                        gateStatus: null,
                        line: 8,
                        items: [
                            { id: 'madde-1', title: 'sözleşme', status: 'done', phaseHeading: 'Dilim 5.2 · Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit', line: 12 },
                            { id: 'madde-2', title: 'kabul', status: 'open', phaseHeading: 'Dilim 5.2 · Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit', line: 13 },
                        ],
                    },
                ],
                nodes: [],
            },
        } as unknown as ProjectRecord;
    }

    const REPORT = ComplianceReport.parse({
        version: 1,
        projectId: 'local-test',
        sourceRevision: 'report-test-0001',
        generatedAt: '2026-08-31T00:00:00.000Z',
        measurement: 'measured',
        reasons: [],
        violations: [
            {
                id: 'hex-in-component:src/app.css:12',
                rule: 'hex-in-component',
                severity: 'error',
                state: 'open',
                targetPath: 'src/app.css',
                targetLine: 12,
                message: 'Hex color literal found outside the token registry.',
                ruleReference: 'UI-SPEC §3.4: bileşende hex yasak',
                contextFriction: 'unmeasured',
                changeCount: 0,
            },
        ],
        sync: [],
        conflicts: [],
        health: { phaseDone: 0, partial: 0, open: 0, syncStale: 0, vioErr: 1, vioWarn: 0, conflictOpen: 0 },
        coverage: { eligibleFiles: 1, scannedFiles: 1, skippedLargeFiles: 0, unreadableFiles: 0, skippedSymlinks: 0, outsideRootPaths: 0, truncated: false },
    });

    it('explain sorgu çözümleyicisi geçerli kind+id dışını reddeder', () => {
        const url = (query: string): URL => new URL(`http://127.0.0.1:4173/explain${query}`);
        expect(explainRouteQuery(url('?kind=violation&id=v-1'))).toEqual({ kind: 'violation', id: 'v-1', phase: null, item: null });
        expect(explainRouteQuery(url('?kind=delta-item&phase=Dilim%201&item=madde-1'))).toBeNull();
        expect(explainRouteQuery(url('?kind=delta-item&id=k&phase=Dilim%201&item=madde-1'))?.phase).toBe('Dilim 1');
        expect(explainRouteQuery(url('?kind=bilinmeyen&id=x'))).toBeNull();
        expect(explainRouteQuery(url('?kind=violation'))).toBeNull();
        expect(explainRouteQuery(url('?kind=coverage'))).toEqual({ kind: 'coverage', id: '', phase: null, item: null });
    });

    it('sliceAcceptanceText bölümdeki kabul cümlesini çıkarır; yoksa null döner', () => {
        expect(sliceAcceptanceText(PLAN, 'Dilim 5.2 · Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit')).toContain('insanca onaylanmalı');
        expect(sliceAcceptanceText(PLAN, 'Dilim 5 · Uyum Telemetrisi')).toBeNull();
        expect(sliceAcceptanceText(PLAN, 'Dilim 9 · Yok')).toBeNull();
    });

    it('canlı PLAN Dilim 5.2 için bağlayıcı kabul metni taşır', () => {
        const livePlan = readFileSync(resolve('PLAN.md'), 'utf8');
        const acceptance = sliceAcceptanceText(livePlan, 'Dilim 5.2 · Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit');
        expect(acceptance).toContain('TECHNICALLY_HARDENED');
        expect(acceptance).toContain('REAL_CORPUS_ACCEPTANCE_OPEN');
    });

    it('ihlal zarfı dört soruyu dürüstçe taşır ve ölçülen raporu DEĞİŞTİRMEZ', async () => {
        const frozen = JSON.stringify(REPORT);
        const project = projectFixture();
        const envelope = await buildProjectExplain(project, { kind: 'violation', id: 'hex-in-component:src/app.css:12', phase: null, item: null }, { report: REPORT, provider: null });
        expect(ExplanationEnvelope.parse(envelope)).toBeTruthy();
        expect(envelope.schemaVersion).toBe(1);
        expect(envelope.origin).toBe('deterministic');
        expect(envelope.subjectKind).toBe('violation');
        expect(envelope.whatItMeans.tr.length).toBeGreaterThan(0);
        expect(envelope.whyItMatters.en.length).toBeGreaterThan(0);
        expect(envelope.recommendedActions.length).toBeGreaterThan(0);
        expect(envelope.verificationSteps.length).toBeGreaterThan(0);
        expect(envelope.evidenceRefs.some((ref) => ref.value.includes('src/app.css'))).toBe(true);
        expect(JSON.stringify(REPORT)).toBe(frozen);
    });

    it('bilinmeyen konum 404 benzeri hatayla reddedilir; sahte zarf üretilmez', async () => {
        await expect(buildProjectExplain(projectFixture(), { kind: 'violation', id: 'yok', phase: null, item: null }, { report: REPORT, provider: null })).rejects.toThrow(/Violation not found/);
        await expect(buildProjectExplain(projectFixture(), { kind: 'plan-slice', id: 'Dilim-9', phase: null, item: null }, { provider: null })).rejects.toThrow(/Plan slice not found/);
    });

    it('plan-slice zarfı amacı, sayaçları ve kabul metnini taşır; Dilim 5 ile 5.2 karışmaz', async () => {
        const project = projectFixture();
        const slice = await buildProjectExplain(project, { kind: 'plan-slice', id: 'Dilim-5.2', phase: null, item: null }, { provider: null });
        expect(slice.subjectKind).toBe('plan-slice');
        expect(slice.summary.tr).toContain('Dilim 5.2');
        expect(slice.summary.tr).not.toContain('Uyum Telemetrisi');
        expect(slice.whatItMeans.tr).toContain('1 açık');
        expect(slice.verificationSteps[0]?.tr ?? '').toContain('insanca onaylanmalı');
        const older = await buildProjectExplain(project, { kind: 'plan-slice', id: 'Dilim-5', phase: null, item: null }, { provider: null });
        expect(older.summary.tr).toContain('Uyum Telemetrisi');
        expect(older.summary.tr).not.toContain('Dilim 5.2');
        expect(older.verificationSteps[0]?.tr ?? '').toContain('ayrı kabul metni yok');
        // Grup sırası tersine döndüğünde de kısmi sürüm öneki eşleşmez:
        // "Dilim-5" isteği asla "Dilim 5.2" başlığına düşmez.
        const reversed = projectFixture();
        const groups = reversed.index.groups.slice().reverse();
        reversed.index.groups = groups;
        const reversedSlice = await buildProjectExplain(reversed, { kind: 'plan-slice', id: 'Dilim-5', phase: null, item: null }, { provider: null });
        expect(reversedSlice.summary.tr).toContain('Uyum Telemetrisi');
        expect(reversedSlice.summary.tr).not.toContain('Dilim 5.2');
    });

    it('fixture sağlayıcı açıkken zarf AI katmanı taşır; sağlayıcı hatasında deterministik zarf korunur', async () => {
        const project = projectFixture();
        const provider = createExplainAiProvider({ KOKPIT_AI_EXPLAIN: 'fixture' } as unknown as NodeJS.ProcessEnv);
        expect(provider).toBeTruthy();
        const aiEnvelope = await buildProjectExplain(project, { kind: 'violation', id: 'hex-in-component:src/app.css:12', phase: null, item: null }, { report: REPORT, provider });
        expect(aiEnvelope.origin).toBe('ai');
        expect(aiEnvelope.provider).toBeTruthy();
        expect(aiEnvelope.model).toBeTruthy();
        expect((aiEnvelope.limitations ?? []).length).toBeGreaterThan(0);
        expect(aiEnvelope.subjectKind).toBe('violation');

        const failing = {
            id: 'bozuk-saglayici',
            model: 'test-1',
            generate: async () => { throw new Error('ağ yok'); },
        };
        const fallback = await buildProjectExplain(project, { kind: 'violation', id: 'hex-in-component:src/app.css:12', phase: null, item: null }, { report: REPORT, provider: failing });
        expect(fallback.origin).toBe('deterministic');
        expect(JSON.stringify(fallback)).not.toContain('ağ yok');
        expect((fallback.limitations ?? []).some((limitation) => /alınamadı|unavailable/i.test(limitation.en))).toBe(true);
    });
});
