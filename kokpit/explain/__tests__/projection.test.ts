// Projection nöbetçisi — Dilim 5.2 (DESIGN D8.1).
//
// buildViolationEnvelope / buildSyncEnvelope / buildConflictEnvelope /
// buildDeltaEnvelope / buildSliceEnvelope / buildCoverageEnvelope gerçek
// ölçüm şemalarıyla (ComplianceReport v1, DeltaResult v1) test edilir:
// girdiler deep-freeze edilir — projection girdiyi DEĞİŞTİRMEZ.

import { describe, expect, it } from 'vitest';
import { ComplianceReport, ConflictEntry, SyncEntry, Violation } from '../../check/schema';
import { DeltaResult } from '../../delta/schema';
import { explainRuleCode, explainSyncReasonCode } from '../catalog';
import {
    buildConflictEnvelope,
    buildCoverageEnvelope,
    buildDeltaEnvelope,
    buildSliceEnvelope,
    buildSyncEnvelope,
    buildViolationEnvelope,
} from '../project';
import { ExplanationEnvelope } from '../schema';

function deepFreeze<T>(value: T): T {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value as object)) {
            deepFreeze((value as Record<string, unknown>)[key]);
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                deepFreeze(item);
            }
        }
    }
    return value;
}

function baseReport(): ComplianceReport {
    return ComplianceReport.parse({
        version: 1,
        projectId: 'demo-proje',
        sourceRevision: 'rev-abc123',
        generatedAt: '2026-08-31T09:00:00.000Z',
        measurement: 'measured',
        reasons: [],
        violations: [],
        sync: [],
        conflicts: [],
        health: { phaseDone: 2, partial: 1, open: 1, syncStale: 0, vioErr: 0, vioWarn: 0, conflictOpen: 0 },
        coverage: {
            eligibleFiles: 12,
            scannedFiles: 12,
            skippedLargeFiles: 0,
            unreadableFiles: 0,
            skippedSymlinks: 0,
            outsideRootPaths: 0,
            truncated: false,
        },
    });
}

function hexViolation() {
    return Violation.parse({
        id: 'hex-in-component:ui-badge:12',
        rule: 'hex-in-component',
        severity: 'error',
        state: 'open',
        targetPath: 'ui/badge.ts',
        targetLine: 12,
        message: 'hex #ff0000 found in component',
        ruleReference: 'AGENTS/DESIGN: bileşende hex yasak; yalnız --st-* belirteçleri',
        contextFriction: 'unmeasured',
        changeCount: 0,
    });
}

function measuredDelta() {
    return DeltaResult.parse({
        schemaVersion: 1,
        projectId: 'demo-proje',
        itemId: '5.2.2',
        phaseHeading: 'Katalog',
        mode: 'measured',
        baseRevision: { kind: 'commit', revision: 'base-1', commit: 'deadbeef', branch: 'main' },
        declaredPaths: ['kokpit/explain/catalog.ts'],
        affectedNodeIds: ['catalog'],
        affectedPaths: ['kokpit/explain/catalog.ts'],
        affectedTests: ['catalog.test.ts'],
        proposedNodes: [],
        addedEdges: [{ from: 'catalog', to: 'schema' }],
        removedEdges: [],
        evidenceKind: 'receipt-mapping',
        reasons: [],
        durationMs: 12,
    });
}

describe('buildViolationEnvelope', () => {
    it('summary kuralın sade adıdır (katalogdan)', () => {
        const report = baseReport();
        const violation = hexViolation();
        const envelope = buildViolationEnvelope(report, violation);
        expect(envelope.summary).toEqual(explainRuleCode(violation.rule, { projectId: report.projectId, sourceRevision: report.sourceRevision, subjectId: violation.id }).summary);
        expect(() => ExplanationEnvelope.parse(envelope)).not.toThrow();
    });

    it('teknik kanıt dosya:satır, kural referansı, kural kodu ve revizyonu taşır', () => {
        const envelope = buildViolationEnvelope(baseReport(), hexViolation());
        const values = envelope.evidenceRefs.map((ref) => ref.value);
        expect(values).toEqual(['ui/badge.ts:12', 'AGENTS/DESIGN: bileşende hex yasak; yalnız --st-* belirteçleri', 'hex-in-component', 'rev-abc123']);
    });

    it('targetLine yoksa kanıt yalnız yolu taşır', () => {
        const violation = hexViolation();
        const noLine = Violation.parse({ ...violation, targetLine: undefined });
        const envelope = buildViolationEnvelope(baseReport(), noLine);
        expect(envelope.evidenceRefs[0]?.value).toBe('ui/badge.ts');
    });

    it('contextFriction unmeasured ise dürüstlük notu düşer', () => {
        const envelope = buildViolationEnvelope(baseReport(), hexViolation());
        expect(envelope.limitations.some((limit) => limit.tr === 'Bağlam ciddiyeti ölçülmedi.')).toBe(true);
    });

    it('ölçülmüş bağlam ciddiyetinde sahte limitation üretilmez', () => {
        const violation = Violation.parse({ ...hexViolation(), contextFriction: 'low', changeCount: 2 });
        const envelope = buildViolationEnvelope(baseReport(), violation);
        expect(envelope.limitations.some((limit) => limit.tr === 'Bağlam ciddiyeti ölçülmedi.')).toBe(false);
    });

    it('girdiyi deep-freeze ile değiştirmez', () => {
        const report = deepFreeze(baseReport());
        const violation = deepFreeze(hexViolation());
        const before = JSON.stringify([report, violation]);
        buildViolationEnvelope(report, violation);
        expect(JSON.stringify([report, violation])).toBe(before);
    });
});

describe('buildSyncEnvelope', () => {
    it('near-miss katalogdan çevrilir; teknik kanıt üç durum + dilim kimliğidir', () => {
        const entry = SyncEntry.parse({
            sliceId: 'dilim-5-2',
            phaseFile: 'current',
            roadmapBox: 'stale',
            handoff: 'current',
            nearMiss: { reasonCode: 'date-gap', message: 'plan 2026-08-30, teslim 2026-08-20' },
        });
        const envelope = buildSyncEnvelope(baseReport(), entry);
        expect(envelope.summary).toEqual(
            explainSyncReasonCode('date-gap', { projectId: 'demo-proje', sourceRevision: 'rev-abc123', subjectId: 'dilim-5-2' }).summary,
        );
        const values = envelope.evidenceRefs.map((ref) => ref.value);
        expect(values).toEqual(['dilim-5-2', 'current', 'stale', 'current']);
        expect(() => ExplanationEnvelope.parse(envelope)).not.toThrow();
    });

    it('üç kayıt güncelse dürüst olumlu özet ve eylemsizlik verir', () => {
        const entry = SyncEntry.parse({ sliceId: 'dilim-4', phaseFile: 'current', roadmapBox: 'current', handoff: 'current' });
        const envelope = buildSyncEnvelope(baseReport(), entry);
        expect(envelope.summary.tr).toBe('Plan kayıtları güncel');
        expect(envelope.recommendedActions[0]?.id).toBe('none');
    });

    it('uyumsuzluk kullanıcı diline çevrilir; kod ilk katmana taşınmaz', () => {
        const entry = SyncEntry.parse({ sliceId: 'dilim-3', phaseFile: 'missing', roadmapBox: 'current', handoff: 'partial' });
        const envelope = buildSyncEnvelope(baseReport(), entry);
        expect(envelope.summary.tr).toContain('faz belgesi eksik');
        expect(envelope.summary.tr).toContain('teslim kaydı kısmi');
        expect(envelope.summary.en).toContain('phase file missing');
        expect(envelope.summary.tr).not.toMatch(/near-miss/);
        expect(envelope.recommendedActions[0]?.id).toBe('run-compliance');
    });

    it('girdiyi değiştirmez', () => {
        const report = deepFreeze(baseReport());
        const entry = deepFreeze(SyncEntry.parse({ sliceId: 'dilim-3', phaseFile: 'stale', roadmapBox: 'current', handoff: 'current' }));
        const before = JSON.stringify([report, entry]);
        buildSyncEnvelope(report, entry);
        expect(JSON.stringify([report, entry])).toBe(before);
    });
});

describe('buildConflictEnvelope', () => {
    it('candidate insan doğrulaması sınırını limitations taşır', () => {
        const conflict = ConflictEntry.parse({
            id: 'c-1',
            topic: 'yorum dili',
            status: 'candidate',
            authorityA: 'AGENTS.md',
            authorityB: 'DESIGN.md',
            observedAtA: '2026-08-01',
            observedAtB: '2026-08-20',
            suggestion: 'İnsan incelemesi',
        });
        const envelope = buildConflictEnvelope(baseReport(), conflict);
        expect(envelope.limitations.some((limit) => limit.tr.includes('insan-inceleme adayıdır'))).toBe(true);
        expect(envelope.limitations.some((limit) => limit.tr.includes('onaylanmadan açık çelişki sayılmaz'))).toBe(true);
        expect(envelope.recommendedActions.some((action) => action.id === 'human-review')).toBe(true);
        const values = envelope.evidenceRefs.map((ref) => ref.value);
        expect(values).toEqual(['AGENTS.md', 'DESIGN.md', '2026-08-01', '2026-08-20']);
        expect(() => ExplanationEnvelope.parse(envelope)).not.toThrow();
    });

    it('girdiyi değiştirmez', () => {
        const report = deepFreeze(baseReport());
        const conflict = deepFreeze(
            ConflictEntry.parse({
                id: 'c-2',
                topic: 'örnek konu',
                status: 'superseded-chain',
                authorityA: 'eski-belge.md',
                authorityB: 'yeni-belge.md',
                observedAtA: '2026-01-01',
                observedAtB: '2026-08-01',
                suggestion: 'Zinciri doğrula',
            }),
        );
        const before = JSON.stringify([report, conflict]);
        buildConflictEnvelope(report, conflict);
        expect(JSON.stringify([report, conflict])).toBe(before);
    });
});

describe('buildDeltaEnvelope', () => {
    it('measured delta özet verir; kanıt makbuz eşlemesini gösterir', () => {
        const envelope = buildDeltaEnvelope(measuredDelta(), { projectId: 'demo-proje', sourceRevision: 'rev-abc123' });
        expect(envelope.summary.tr).toContain('Delta ölçüldü');
        expect(envelope.summary.tr).toContain('1 yol');
        expect(envelope.recommendedActions[0]?.id).toBe('select-item');
        expect(envelope.evidenceRefs[0]?.value).toBe('receipt-mapping');
        expect(envelope.limitations).toHaveLength(0);
        expect(() => ExplanationEnvelope.parse(envelope)).not.toThrow();
    });

    it('measured ama makbuz eşlemesi altında kanıt varsa dürüst limitation düşer', () => {
        const delta = DeltaResult.parse({ ...measuredDelta(), evidenceKind: 'declared-text-only' });
        const envelope = buildDeltaEnvelope(delta, { projectId: 'demo-proje', sourceRevision: 'rev-abc123' });
        expect(envelope.limitations.some((limit) => limit.tr.includes('makbuz eşlemesi düzeyinde değil'))).toBe(true);
    });

    it('unmeasurable: her neden için katalog açıklaması ve eylemi birleşir', () => {
        const delta = DeltaResult.parse({
            ...measuredDelta(),
            mode: 'unmeasurable',
            evidenceKind: 'none',
            affectedNodeIds: [],
            affectedPaths: [],
            affectedTests: [],
            addedEdges: [],
            reasons: [
                { code: 'stale-receipt', message: 'receipt older than HEAD' },
                { code: 'no-mapping', message: 'no receipt mapping for item' },
            ],
        });
        const envelope = buildDeltaEnvelope(delta, { projectId: 'demo-proje', sourceRevision: 'rev-abc123' });
        const actionIds = envelope.recommendedActions.map((action) => action.id);
        expect(actionIds).toContain('reindex');
        expect(actionIds).toContain('map-plan-path');
        expect(envelope.whatItMeans.tr.length).toBeGreaterThan(0);
        expect(envelope.limitations.some((limit) => limit.tr.includes('2 farklı neden'))).toBe(true);
        const reasonValues = envelope.evidenceRefs.map((ref) => ref.value);
        expect(reasonValues).toContain('stale-receipt');
        expect(reasonValues).toContain('no-mapping');
        expect(() => ExplanationEnvelope.parse(envelope)).not.toThrow();
    });

    it('unmeasurable ve reasons boşsa jenerik dürüst zarf verir (boş beyaz alan yok)', () => {
        const delta = DeltaResult.parse({
            ...measuredDelta(),
            mode: 'unmeasurable',
            evidenceKind: 'none',
            affectedNodeIds: [],
            affectedPaths: [],
            affectedTests: [],
            addedEdges: [],
            reasons: [],
        });
        const envelope = buildDeltaEnvelope(delta, { projectId: 'demo-proje', sourceRevision: 'rev-abc123' });
        expect(envelope.summary.tr).toBe('Delta ölçülemedi');
        expect(envelope.limitations.length).toBeGreaterThanOrEqual(1);
        expect(envelope.recommendedActions[0]?.id).toBe('none');
    });

    it('declared-only delta ölçülmediğini dürüstçe söyler', () => {
        const delta = DeltaResult.parse({ ...measuredDelta(), mode: 'declared-only', evidenceKind: 'declared-text-only', addedEdges: [] });
        const envelope = buildDeltaEnvelope(delta, { projectId: 'demo-proje', sourceRevision: 'rev-abc123' });
        expect(envelope.summary.tr).toContain('yalnız bildirildi');
        expect(envelope.limitations.some((limit) => limit.tr.includes('ölçülmedi'))).toBe(true);
    });

    it('girdiyi değiştirmez', () => {
        const delta = deepFreeze(measuredDelta());
        const before = JSON.stringify(delta);
        buildDeltaEnvelope(delta, { projectId: 'demo-proje', sourceRevision: 'rev-abc123' });
        expect(JSON.stringify(delta)).toBe(before);
    });
});

describe('buildSliceEnvelope', () => {
    const context = {
        projectId: 'demo-proje',
        sourceRevision: 'rev-abc123',
        phaseId: 'dilim-5-2',
        heading: 'Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit',
        counts: { done: 3, partial: 1, open: 2, blocked: 1 },
    };

    it('amaç = başlık; durum = sayaç özeti', () => {
        const envelope = buildSliceEnvelope(context);
        expect(envelope.summary.tr).toBe(context.heading);
        expect(envelope.whatItMeans.tr).toContain('3 tamamlandı');
        expect(envelope.whatItMeans.tr).toContain('1 engelli');
        expect(envelope.subjectKind).toBe('plan-slice');
        expect(envelope.subjectId).toBe('dilim-5-2');
        expect(() => ExplanationEnvelope.parse(envelope)).not.toThrow();
    });

    it('kabul metni varsa doğrulama adımı onu taşır', () => {
        const acceptanceText = { tr: 'Gerçek korpus koşumu yeşil.', en: 'Real corpus run is green.' };
        const envelope = buildSliceEnvelope({ ...context, acceptanceText });
        expect(envelope.verificationSteps[0]).toEqual(acceptanceText);
    });

    it('kabul metni yoksa dürüst yok notu verir (sahte kabul üretilmez)', () => {
        const envelope = buildSliceEnvelope(context);
        expect(envelope.verificationSteps[0]?.tr).toContain('ayrı kabul metni yok');
    });

    it('engelli madde ve dış sınırlar limitations listelenir', () => {
        const openExternalLimits = [{ tr: 'Gerçek korpus kabulü açık.', en: 'Real corpus acceptance is open.' }];
        const envelope = buildSliceEnvelope({ ...context, openExternalLimits });
        expect(envelope.limitations[0]).toEqual(openExternalLimits[0]);
        expect(envelope.limitations.some((limit) => limit.tr.includes('engelli'))).toBe(true);
        expect(envelope.limitations.some((limit) => limit.tr.includes('2 açık madde'))).toBe(true);
        expect(envelope.limitations.length).toBeLessThanOrEqual(8);
    });
});

describe('buildCoverageEnvelope', () => {
    it('ölçülmüş temiz kapsamda dürüst olumlu özet ve 7 kapsam sayacı verir', () => {
        const envelope = buildCoverageEnvelope(baseReport());
        expect(envelope.summary.tr).toContain('tamamı tarandı');
        expect(envelope.subjectKind).toBe('coverage');
        expect(envelope.subjectId).toBe('coverage');
        expect(envelope.evidenceRefs).toHaveLength(7);
        expect(envelope.evidenceRefs[6]?.value).toBe('false');
        expect(() => ExplanationEnvelope.parse(envelope)).not.toThrow();
    });

    it('unmeasured koşumda nedenler katalogdan açıklanır; boş sonuç temiz sayılmaz', () => {
        const report = ComplianceReport.parse({
            ...baseReport(),
            measurement: 'unmeasured',
            reasons: [{ code: 'root-unreadable', message: 'EACCES on root' }],
            violations: [],
        });
        const envelope = buildCoverageEnvelope(report);
        expect(envelope.summary.tr.length).toBeGreaterThan(0);
        expect(envelope.recommendedActions.some((action) => action.id === 'link-local-checkout')).toBe(true);
        expect(envelope.limitations.some((limit) => limit.tr.includes('hiçbir kural değerlendirilmedi'))).toBe(true);
    });

    it('kırpma sayaçları dürüst eylem/limitation üretir', () => {
        const report = ComplianceReport.parse({
            ...baseReport(),
            measurement: 'partial',
            reasons: [{ code: 'scan-truncated', message: 'record cap reached' }],
            coverage: {
                eligibleFiles: 500,
                scannedFiles: 200,
                skippedLargeFiles: 3,
                unreadableFiles: 1,
                skippedSymlinks: 0,
                outsideRootPaths: 0,
                truncated: true,
            },
        });
        const envelope = buildCoverageEnvelope(report);
        expect(envelope.evidenceRefs[6]?.value).toBe('true');
        expect(envelope.limitations.some((limit) => limit.tr.includes('alt sınırdır'))).toBe(true);
        expect(envelope.recommendedActions.length).toBeGreaterThanOrEqual(1);
        expect(() => ExplanationEnvelope.parse(envelope)).not.toThrow();
    });

    it('bilinmeyen neden kodu kapsamda çökmez; dürüst boşluk notu düşer', () => {
        const report = ComplianceReport.parse({
            ...baseReport(),
            measurement: 'partial',
            reasons: [{ code: 'tanimsiz-yeni-kod', message: 'unknown yet' }],
        });
        const envelope = buildCoverageEnvelope(report);
        expect(() => ExplanationEnvelope.parse(envelope)).not.toThrow();
        expect(envelope.limitations.some((limit) => limit.tr.includes('kataloğa eklenmedi'))).toBe(true);
    });

    it('girdiyi değiştirmez', () => {
        const report = deepFreeze(baseReport());
        const before = JSON.stringify(report);
        buildCoverageEnvelope(report);
        expect(JSON.stringify(report)).toBe(before);
    });
});
