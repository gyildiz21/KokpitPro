import { describe, expect, it } from 'vitest';
import {
    ClosureRequest,
    ComplianceReport,
    ComplianceHealth,
    Violation,
    type ComplianceReport as ComplianceReportType,
} from '../schema';

const validViolation: Record<string, unknown> = {
    id: 'koşumsuz-commit-plan-md-l348',
    rule: 'koşumsuz-commit',
    severity: 'warning',
    state: 'open',
    targetPath: 'PLAN.md',
    targetLine: 348,
    message: 'Test message',
    ruleReference: 'PLAN.md kural 3',
    contextFriction: 'low',
    changeCount: 0,
};

function reportOver(overrides: Partial<Record<string, unknown>>): ComplianceReportType {
    const base: Record<string, unknown> = {
        version: 1,
        projectId: 'local-kokpitpro',
        generatedAt: '2026-08-27T10:00:00.000Z',
        measurement: 'measured',
        reasons: [],
        violations: [validViolation],
        sync: [],
        conflicts: [],
        health: {
            phaseDone: 4,
            partial: 1,
            open: 2,
            syncStale: 0,
            vioErr: 0,
            vioWarn: 1,
            conflictOpen: 0,
        },
        ...overrides,
    };
    return ComplianceReport.parse(base);
}

describe('ComplianceReport şema dondurması — Dilim 5', () => {
    it('geçerli minimum raporu kabul eder', () => {
        const parsed = reportOver({});
        expect(parsed.version).toBe(1);
        expect(parsed.violations).toHaveLength(1);
    });

    it('bilinmeyen üst-alanı .strict() ile reddeder', () => {
        expect(() => reportOver({ healthScore: 87 })).toThrow();
    });

    it('tek birleşik sağlık yüzdesi alanı taşınamaz (sağlık bantları dondurulmuş)', () => {
        expect(() =>
            ComplianceHealth.parse({
                phaseDone: 1,
                partial: 0,
                open: 0,
                syncStale: 0,
                vioErr: 0,
                vioWarn: 0,
                conflictOpen: 0,
                scorePercent: 90,
            }),
        ).toThrow();
    });

    it('kapatılmış ihlal gerekçe/kim/zaman olmadan şemayı geçemez', () => {
        expect(() => Violation.parse({ ...validViolation, state: 'closed' })).toThrow();
        const closed = Violation.parse({
            ...validViolation,
            state: 'closed',
            closedAt: '2026-08-27T12:00:00.000Z',
            closedBy: 'patron',
            closureJustification: 'Kural belgeden kaldırıldı; karar kaydı bağlantılı.',
        });
        expect(closed.state).toBe('closed');
    });

    it('kapatma isteği boş gerekçeyle reddedilir', () => {
        expect(() =>
            ClosureRequest.parse({ violationId: 'v1', justification: '   ', by: 'patron' }),
        ).toThrow();
        expect(ClosureRequest.parse({ violationId: 'v1', justification: 'gerekçe', by: 'p' }).justification).toBe(
            'gerekçe',
        );
    });

    it('ölçüm modu unmeasured iken bile rapor sahte temizlik iddiası taşıyan alan içeremez', () => {
        // measurement:'unmeasured' + boş listeler = "ölçülemedi"; "temiz" gibi
        // sunulamaz. Şemada clean/ok alanı bulunmadığından bu yapısal garantidir.
        const parsed = reportOver({ measurement: 'unmeasured', violations: [], reasons: [{ code: 'no-local-checkout', message: 'x' }] });
        expect(Object.keys(parsed)).not.toContain('clean');
        expect(parsed.measurement).toBe('unmeasured');
    });
});
