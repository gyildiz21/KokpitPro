// Remap nöbetçi testleri — Dilim 4 · Kanıta dayalı remap önerileri.
//
// analyzeRemap'ın donmuş sözleşmesini sabitler: üç kuralın olumlu/olumsuz
// senaryoları, test/fixture/generated dışlaması, unresolved kenar yasağı,
// determinizm, ölçüm dürüstlüğü, kırpma ve strict şema disiplini.

import { describe, expect, it } from 'vitest';
import { analyzeRemap, type RemapAnalyzeInput } from '../analyze';
import { RemapReport, RemapSuggestion } from '../schema';
import { REMAP_THRESHOLDS } from '../thresholds';
import type { ImportGraphEdge, ImportScanResult } from '../../importgraph/scan';
import type { ProductionFileStat } from '../measure';
import { safeMermaidId } from '../../diagram/mermaid-sanitize';

// --- Deterministik yol kümesi; gruplar architectureGroupIdForPath ile uyumlu. ---
const P_TARGET = 'src/core/util.ts'; // shared
const P_IMP_UI = 'ui/components/badge.ts'; // interface
const P_IMP_RUNTIME = 'runtime/api/health-route.ts'; // runtime
const P_IMP_DATA = 'data/repositories/user-repository.ts'; // data
const P_IMP_AUTO = 'automation/jobs/sync-job.ts'; // automation
const P_BIG_UI = 'ui/screens/report-view.ts'; // interface
const P_BIG_BYTES = 'data/models/log-entry.ts'; // data
const P_XLAYER = 'runtime/api/legacy-handler.ts'; // runtime
const P_IMP_X1 = 'ui/screens/admin-view.ts'; // interface

interface EdgeSpec {
    from: string;
    to: string | null;
    resolved?: boolean;
}

function makeScan(nodes: readonly string[], edges: readonly EdgeSpec[] = [], unresolvedCount = 0): ImportScanResult {
    const built: ImportGraphEdge[] = edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        resolved: edge.resolved ?? edge.to !== null,
        dynamic: false,
        typeOnly: false,
    }));
    return {
        scannedFileCount: nodes.length,
        nodes: nodes.map((path) => ({ path })),
        edges: built,
        unresolvedCount,
        durationMs: 0,
    };
}

function statFor(path: string, lines: number | null, bytes: number): [string, ProductionFileStat] {
    return [path, { path, lines, bytes }];
}

function statsFor(entries: ReadonlyArray<ReturnType<typeof statFor>>): Map<string, ProductionFileStat> {
    return new Map(entries);
}

function makeInput(overrides: Partial<RemapAnalyzeInput> = {}): RemapAnalyzeInput {
    return {
        projectId: 'local-kokpitpro',
        sourceRevision: '7d1501a',
        generatedAt: '2026-08-29T12:00:00.000Z',
        scan: makeScan([P_TARGET, P_BIG_UI]),
        ...overrides,
    };
}

function suggestionById(report: RemapReport, id: string): RemapSuggestion {
    const found = report.suggestions.find((suggestion) => suggestion.id === id);
    if (!found) throw new Error(`missing suggestion: ${id}`);
    return found;
}

describe('donmuş eşikler', () => {
    it('eşik dosyası ölçüm koşusundaki değerleri aynen taşır', () => {
        expect(REMAP_THRESHOLDS).toEqual({
            largeFile: { minLines: 400, minBytes: 16384 },
            sharedImport: { minImporterFiles: 4, minImporterGroups: 2 },
            crossLayerPlacementReview: { minForeignImporterGroups: 2 },
            maxSuggestions: 24,
        });
    });
});

describe('large-file kuralı', () => {
    it('satır VEYA bayt eşiğini aşan üretim dosyasını işaretler; lines null ise metrikte yoktur', () => {
        const report = analyzeRemap(makeInput({
            scan: makeScan([P_BIG_UI, P_BIG_BYTES]),
            fileStats: statsFor([
                statFor(P_BIG_UI, 420, 12000),
                statFor(P_BIG_BYTES, null, 20000),
            ]),
        }));
        expect(report.suggestions.map((suggestion) => suggestion.id)).toEqual([
            `remap:large-file:${P_BIG_BYTES}`,
            `remap:large-file:${P_BIG_UI}`,
        ]);
        const byBytes = suggestionById(report, `remap:large-file:${P_BIG_BYTES}`);
        expect(byBytes.kind).toBe('large-file');
        expect(byBytes.reasonCode).toBe('size-over-threshold');
        expect(byBytes.metrics).toEqual({ bytes: 20000 });
        expect('lines' in byBytes.metrics).toBe(false);
        expect(byBytes.relatedGroups).toEqual(['data']);
        const byLines = suggestionById(report, `remap:large-file:${P_BIG_UI}`);
        expect(byLines.metrics).toEqual({ lines: 420, bytes: 12000 });
        expect(byLines.relatedGroups).toEqual(['interface']);
        expect(report.measurement).toBe('measured');
        expect(report.truncated).toBe(false);
    });

    it('eşik altındaki dosya işaretlenmez (olumsuz senaryo)', () => {
        const report = analyzeRemap(makeInput({
            scan: makeScan([P_BIG_UI]),
            fileStats: statsFor([statFor(P_BIG_UI, 399, 16383)]),
        }));
        expect(report.suggestions).toEqual([]);
        expect(report.measurement).toBe('measured');
    });
});

describe('shared-import kuralı', () => {
    const importers = [P_IMP_UI, P_IMP_RUNTIME, P_IMP_DATA, P_IMP_AUTO];

    it('≥4 üretim importer VE ≥2 grup durumunu işaretler; kanıt sıralıdır', () => {
        const report = analyzeRemap(makeInput({
            scan: makeScan(
                [P_TARGET, ...importers],
                importers.map((from) => ({ from, to: P_TARGET })),
            ),
            fileStats: statsFor([
                statFor(P_TARGET, 10, 200),
                ...importers.map((path) => statFor(path, 10, 200)),
            ]),
        }));
        const suggestion = suggestionById(report, `remap:shared-import:${P_TARGET}`);
        expect(suggestion.kind).toBe('shared-import');
        expect(suggestion.reasonCode).toBe('fan-in-over-threshold');
        expect(suggestion.metrics).toEqual({ importerFiles: 4, importerGroupCount: 4 });
        expect(suggestion.relatedPaths).toEqual([...importers].sort());
        expect(suggestion.relatedGroups).toEqual(['automation', 'data', 'interface', 'runtime']);
    });

    it('3 importer eşiğin altındadır; yabancı grup da tek kalır (olumsuz senaryo)', () => {
        const sameLayerSibling = 'runtime/api/other-route.ts';
        const report = analyzeRemap(makeInput({
            scan: makeScan(
                [P_XLAYER, sameLayerSibling, P_IMP_RUNTIME, P_IMP_X1],
                [sameLayerSibling, P_IMP_RUNTIME, P_IMP_X1].map((from) => ({ from, to: P_XLAYER })),
            ),
            fileStats: statsFor(
                [P_XLAYER, sameLayerSibling, P_IMP_RUNTIME, P_IMP_X1].map((path) => statFor(path, 10, 200)),
            ),
        }));
        expect(report.suggestions).toEqual([]);
    });

    it('4 importer ama tek mimari grup ise işaretlenmez (olumsuz senaryo)', () => {
        const sameGroup = ['ui/components/a.ts', 'ui/components/b.ts', 'ui/components/c.ts', 'ui/views/card.ts'];
        const report = analyzeRemap(makeInput({
            scan: makeScan(
                [P_TARGET, ...sameGroup],
                sameGroup.map((from) => ({ from, to: P_TARGET })),
            ),
            fileStats: statsFor([P_TARGET, ...sameGroup].map((path) => statFor(path, 10, 200))),
        }));
        expect(report.suggestions).toEqual([]);
    });
});

describe('cross-layer-placement-review kuralı', () => {
    it('≥2 farklı yabancı importer grubunu işaretler; yalnız YABANCI grupları kanıtlar', () => {
        const report = analyzeRemap(makeInput({
            scan: makeScan(
                [P_XLAYER, P_IMP_X1, P_IMP_DATA],
                [
                    { from: P_IMP_X1, to: P_XLAYER },
                    { from: P_IMP_DATA, to: P_XLAYER },
                ],
            ),
            fileStats: statsFor([P_XLAYER, P_IMP_X1, P_IMP_DATA].map((path) => statFor(path, 10, 200))),
        }));
        const ids = report.suggestions.map((suggestion) => suggestion.id);
        expect(ids).toEqual([`remap:cross-layer-placement-review:${P_XLAYER}`]);
        const suggestion = suggestionById(report, ids[0]!);
        expect(suggestion.kind).toBe('cross-layer-placement-review');
        expect(suggestion.reasonCode).toBe('placement-review-multi-group');
        expect(suggestion.metrics).toEqual({ importerGroupCount: 2, foreignGroupCount: 2 });
        expect(suggestion.relatedGroups).toEqual(['data', 'interface']);
        expect(suggestion.relatedGroups).not.toContain('runtime');
        expect(suggestion.relatedPaths).toEqual([P_IMP_DATA, P_IMP_X1].sort());
    });

    it('tek yabancı grup işaretlenmez (olumsuz senaryo)', () => {
        const report = analyzeRemap(makeInput({
            scan: makeScan(
                [P_XLAYER, P_IMP_X1, P_IMP_RUNTIME],
                [
                    { from: P_IMP_X1, to: P_XLAYER },
                    { from: P_IMP_RUNTIME, to: P_XLAYER },
                ],
            ),
            fileStats: statsFor([P_XLAYER, P_IMP_X1, P_IMP_RUNTIME].map((path) => statFor(path, 10, 200))),
        }));
        expect(report.suggestions).toEqual([]);
    });
});

describe('dışlama ve kanıt disiplini', () => {
    it('test/fixture/generated dosyaları öneri üretmez, testOrFixtureFiles sayılır', () => {
        const testPath = 'kokpit/importgraph/__tests__/scan.test.ts';
        const fixturePath = 'kokpit/diagram/__fixtures__/sample.ts';
        const generatedPath = 'kokpit/parser/generated/tables.ts';
        const nodes = [P_TARGET, P_IMP_UI, testPath, fixturePath, generatedPath];
        const report = analyzeRemap(makeInput({
            scan: makeScan(
                nodes,
                [testPath, fixturePath, generatedPath, P_IMP_UI].map((from) => ({ from, to: P_TARGET })),
            ),
            fileStats: statsFor([P_TARGET, P_IMP_UI].map((path) => statFor(path, 10, 200))),
        }));
        expect(report.suggestions).toEqual([]);
        expect(report.measurement).toBe('measured');
        expect(report.coverage.eligibleFiles).toBe(2);
        expect(report.coverage.scannedFiles).toBe(5);
        expect(report.coverage.testOrFixtureFiles).toBe(3);
        expect(report.coverage.unresolvedImports).toBe(0);
    });

    it('unresolved kenar asla kanıt sayılmaz', () => {
        const report = analyzeRemap(makeInput({
            scan: makeScan(
                [P_XLAYER, P_IMP_X1, P_IMP_DATA],
                [
                    { from: P_IMP_X1, to: P_XLAYER },
                    { from: P_IMP_DATA, to: null, resolved: false },
                ],
                1,
            ),
            fileStats: statsFor([P_XLAYER, P_IMP_X1, P_IMP_DATA].map((path) => statFor(path, 10, 200))),
        }));
        expect(report.suggestions).toEqual([]);
        expect(report.coverage.unresolvedImports).toBe(1);
        expect(report.measurement).toBe('measured');
    });

    it('ölçülmüş ve boş öneri listesi meşrudur — dolgu üretilmez', () => {
        const report = analyzeRemap(makeInput({
            scan: makeScan([P_TARGET]),
            fileStats: statsFor([statFor(P_TARGET, 10, 200)]),
        }));
        expect(report.measurement).toBe('measured');
        expect(report.suggestions).toEqual([]);
        expect(report.reasons).toEqual([]);
    });
});

describe('ölçüm dürüstlüğü', () => {
    it('fileStats verilmezse partial + file-stats-unavailable olur', () => {
        const report = analyzeRemap(makeInput({ scan: makeScan([P_BIG_UI]) }));
        expect(report.measurement).toBe('partial');
        expect(report.reasons.map((reason) => reason.code)).toContain('file-stats-unavailable');
        expect(report.suggestions).toEqual([]);
    });

    it('stat girdisi eksik üretim dosyası partial + unreadable-files olur', () => {
        const report = analyzeRemap(makeInput({
            scan: makeScan([P_BIG_UI, P_TARGET]),
            fileStats: statsFor([statFor(P_TARGET, 10, 200)]),
        }));
        expect(report.measurement).toBe('partial');
        expect(report.reasons.map((reason) => reason.code)).toContain('unreadable-files');
        expect(report.suggestions).toEqual([]);
    });
});

describe('kırpma', () => {
    const manyPaths = Array.from({ length: 26 }, (_, index) => `src/core/candidate-${String(index).padStart(2, '0')}.ts`);

    it('24 adayın üstü kırılır; truncated + neden + kapsam dürüstçe bildirilir', () => {
        const report = analyzeRemap(makeInput({
            scan: makeScan(manyPaths),
            fileStats: statsFor(manyPaths.map((path) => statFor(path, 500, 100))),
        }));
        expect(report.suggestions).toHaveLength(REMAP_THRESHOLDS.maxSuggestions);
        expect(report.truncated).toBe(true);
        expect(report.coverage.truncated).toBe(true);
        expect(report.reasons.map((reason) => reason.code)).toContain('suggestions-truncated');
        expect(report.suggestions[0]?.id).toBe(`remap:large-file:src/core/candidate-00.ts`);
        expect(report.suggestions[23]?.id).toBe(`remap:large-file:src/core/candidate-23.ts`);
        expect(report.suggestions.some((suggestion) => suggestion.id.endsWith('candidate-24.ts'))).toBe(false);
        expect(report.measurement).toBe('measured');
    });

    it('maxSuggestions girdisi onurlu çalışır ve donmuş üst sınırı aşamaz', () => {
        const limitPaths = manyPaths.slice(0, REMAP_THRESHOLDS.maxSuggestions);
        const base = {
            scan: makeScan(limitPaths),
            fileStats: statsFor(limitPaths.map((path) => statFor(path, 500, 100))),
        };
        const narrow = analyzeRemap(makeInput({ ...base, maxSuggestions: 2 }));
        expect(narrow.suggestions).toHaveLength(2);
        expect(narrow.truncated).toBe(true);
        // Donmuş üst sınıra kıskanan girdi kırpma ÜRETMEZ: 24 ≤ 24.
        const over = analyzeRemap(makeInput({ ...base, maxSuggestions: 100 }));
        expect(over.suggestions).toHaveLength(REMAP_THRESHOLDS.maxSuggestions);
        expect(over.truncated).toBe(false);
    });
});

describe('nodeId disiplini', () => {
    it('nodeId yalnız render edilen hedef yollarında bulunur; aksi hâlde alan yoktur', () => {
        const report = analyzeRemap(makeInput({
            scan: makeScan([P_BIG_UI, P_BIG_BYTES]),
            fileStats: statsFor([
                statFor(P_BIG_UI, 420, 12000),
                statFor(P_BIG_BYTES, null, 20000),
            ]),
            renderedNodePaths: [P_BIG_UI],
        }));
        const rendered = suggestionById(report, `remap:large-file:${P_BIG_UI}`);
        expect(rendered.nodeId).toBe(safeMermaidId(P_BIG_UI));
        const unrendered = suggestionById(report, `remap:large-file:${P_BIG_BYTES}`);
        expect('nodeId' in unrendered).toBe(false);
    });
});

describe('determinizm', () => {
    it('aynı girdi bayt-birebir aynı JSON ve aynı kimlik sırasını üretir', () => {
        const importers = [P_IMP_UI, P_IMP_RUNTIME, P_IMP_DATA, P_IMP_AUTO];
        const input = makeInput({
            scan: makeScan(
                [P_TARGET, P_BIG_UI, P_BIG_BYTES, P_XLAYER, P_IMP_X1, ...importers],
                [
                    ...importers.map((from) => ({ from, to: P_TARGET })),
                    { from: P_IMP_X1, to: P_XLAYER },
                    { from: P_IMP_DATA, to: P_XLAYER },
                ],
            ),
            fileStats: statsFor(
                [P_TARGET, P_BIG_UI, P_BIG_BYTES, P_XLAYER, P_IMP_X1, ...importers].map((path) =>
                    statFor(path, path === P_BIG_UI ? 420 : 10, path === P_BIG_BYTES ? 20000 : 200),
                ),
            ),
            renderedNodePaths: [P_BIG_UI, P_TARGET],
        });
        const left = analyzeRemap(input);
        const right = analyzeRemap(input);
        expect(JSON.stringify(left)).toBe(JSON.stringify(right));
        expect(left.suggestions.map((suggestion) => suggestion.id)).toEqual(
            right.suggestions.map((suggestion) => suggestion.id),
        );
        // Tür sırası (large-file → shared-import → cross-layer), eşitlikte yol artan.
        expect(left.suggestions.map((suggestion) => suggestion.id)).toEqual([
            `remap:large-file:${P_BIG_BYTES}`,
            `remap:large-file:${P_BIG_UI}`,
            `remap:shared-import:${P_TARGET}`,
            `remap:cross-layer-placement-review:${P_XLAYER}`,
            `remap:cross-layer-placement-review:${P_TARGET}`,
        ]);
    });
});

describe('strict şema disiplini', () => {
    function richReport(): RemapReport {
        return analyzeRemap(makeInput({
            scan: makeScan(
                [P_TARGET, ...[P_IMP_UI, P_IMP_RUNTIME, P_IMP_DATA, P_IMP_AUTO]],
                [P_IMP_UI, P_IMP_RUNTIME, P_IMP_DATA, P_IMP_AUTO].map((from) => ({ from, to: P_TARGET })),
            ),
            fileStats: statsFor(
                [P_TARGET, P_IMP_UI, P_IMP_RUNTIME, P_IMP_DATA, P_IMP_AUTO].map((path) => statFor(path, 10, 200)),
            ),
        }));
    }

    it('geçerli raporu kabul eder, rapor düzeyinde bilinmeyen alanı reddeder', () => {
        const report = richReport();
        expect(RemapReport.safeParse(report).success).toBe(true);
        expect(RemapReport.safeParse({ ...report, unexpectedField: true }).success).toBe(false);
    });

    it('öneri düzeyinde bilinmeyen alanı reddeder ve rapor da reddeder', () => {
        const report = richReport();
        const suggestion = report.suggestions[0];
        if (!suggestion) throw new Error('fixture must produce at least one suggestion');
        expect(RemapSuggestion.safeParse(suggestion).success).toBe(true);
        expect(RemapSuggestion.safeParse({ ...suggestion, extra: 1 }).success).toBe(false);
        expect(RemapReport.safeParse({ ...report, suggestions: [{ ...suggestion, extra: 1 }] }).success).toBe(false);
    });

    it('uydurma hedef klasör alanı targetFolder strict şemaca REDDEDİLİR', () => {
        const report = richReport();
        for (const suggestion of report.suggestions) {
            expect('targetFolder' in suggestion).toBe(false);
            expect(
                RemapSuggestion.safeParse({ ...suggestion, targetFolder: 'src/moved/thing.ts' }).success,
            ).toBe(false);
            expect(suggestion.proposed).toBe(true);
        }
    });
});
