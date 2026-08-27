import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectConflicts, detectBrokenSupersededChains } from '../conflicts';
import { buildCompliance } from '../index';
import { detectRuleViolations, type LocalFileSlice, type RuleContext } from '../rules';
import { countSyncStale, deriveSyncEntries, type SyncFileSet } from '../sync';
import type { PhaseGroup } from '../../parser/schema';

const RECEIPT_DATE = '2026-08-27T09:00:00.000Z';

function group(heading: string, items: Array<{ id: string; status: 'done' | 'open' | 'partial'; completedAt?: string; line?: number }>): PhaseGroup {
    return {
        heading,
        items: items.map((item, index) => ({
            id: item.id,
            title: `Madde ${item.id}`,
            status: item.status,
            phaseHeading: heading,
            ...(item.completedAt ? { completedAt: item.completedAt } : {}),
            line: item.line ?? 10 + index,
        })),
    };
}

function fileCtx(files: LocalFileSlice[], groups: PhaseGroup[]): RuleContext {
    return { planPath: 'PLAN.md', groups, files, receiptDate: RECEIPT_DATE };
}

describe('kurallar — başlangıç seti (UI-SPEC §10.4)', () => {
    it('koşumsuz-commit: tarihsiz [x] kutusu uyarı üretir; tarihli üretmez', () => {
        const violations = detectRuleViolations(fileCtx([], [
            group('Dilim A', [
                { id: '#1', status: 'done' },
                { id: '#2', status: 'done', completedAt: '2026-08-01' },
            ]),
        ]));
        const unconditional = violations.filter((violation) => violation.rule === 'koşumsuz-commit');
        expect(unconditional).toHaveLength(1);
        expect(unconditional[0]?.severity).toBe('warning');
        expect(unconditional[0]?.targetLine).toBe(10);
        expect(unconditional[0]?.id).toBe('koşumsuz-commit:plan-md:10');
    });

    it('bayat-kutu: 30 günden eski tamamlanma not üretir; taze üretmez', () => {
        const violations = detectRuleViolations(fileCtx([], [
            group('Dilim A', [
                { id: '#1', status: 'done', completedAt: '2026-01-01' },
                { id: '#2', status: 'done', completedAt: '2026-08-20' },
            ]),
        ]));
        const stale = violations.filter((violation) => violation.rule === 'bayat-kutu');
        expect(stale).toHaveLength(1);
        expect(stale[0]?.severity).toBe('note');
    });

    it('hex-in-component: satır-içi hex hatadır; custom-property TANIM satırları (belirteç kayıt yeri) muaftır', () => {
        const violations = detectRuleViolations(fileCtx([
            { path: 'src/theme.css', content: ':root {\n  --st-done: #10b981;\n  --paper: #FBFBFD;\n}\n.bad { color: #ABCDEF; }\n' },
            { path: 'src/clean.ts', content: 'export const value = 1;\n' },
        ], []));
        const hex = violations.filter((violation) => violation.rule === 'hex-in-component');
        expect(hex).toHaveLength(1);
        expect(hex[0]?.targetLine).toBe(5);
        expect(hex[0]?.severity).toBe('error');
    });

    it('hardcode-metin: ui/*.tsx içindeki Türkçe düz metin uyarıdır; dictionary kullanımı değildir', () => {
        const violations = detectRuleViolations(fileCtx([
            { path: 'kokpit/ui/widget.tsx', content: 'const x = 1;\n<span>Kayıt yüklendi</span>\n' },
            { path: 'kokpit/ui/clean.tsx', content: 'const label = t("ready");\n' },
            { path: 'kokpit/parser/other.ts', content: '<span>Kayıt yüklendi</span>\n' },
        ], []));
        const hardcode = violations.filter((violation) => violation.rule === 'hardcode-metin');
        expect(hardcode).toHaveLength(1);
        expect(hardcode[0]?.targetPath).toBe('kokpit/ui/widget.tsx');
    });

    it('sahte-kapı: committed test kapısı (.skip/.only) uyarı; fake-success işaretçisi hatadır', () => {
        const violations = detectRuleViolations(fileCtx([
            { path: 'kokpit/x/__tests__/a.test.ts', content: 'it.skip("later", () => {});\n' },
            { path: 'kokpit/y/service.ts', content: '// TODO-FAKE: return true when ready\nexport const ok = true;\n' },
        ], []));
        const gates = violations.filter((violation) => violation.rule === 'sahte-kapı');
        expect(gates.map((violation) => violation.severity).sort()).toEqual(['error', 'warning']);
        expect(gates.find((violation) => violation.severity === 'error')?.targetPath).toBe('kokpit/y/service.ts');
    });

    it('ks-band: aynı fazda tamamlanma tarihleri geriye akamaz', () => {
        const violations = detectRuleViolations(fileCtx([], [
            group('Dilim A', [
                { id: '#1', status: 'done', completedAt: '2026-08-10', line: 11 },
                { id: '#2', status: 'done', completedAt: '2026-08-01', line: 12 },
            ]),
        ]));
        const band = violations.filter((violation) => violation.rule === 'ks-band');
        expect(band).toHaveLength(1);
        expect(band[0]?.targetLine).toBe(12);
    });

    it('sıralama friction×severity nöbetçisi: hata üstte, ciddiyet monoton, eşitlikte id lexicographic', () => {
        const violations = detectRuleViolations(fileCtx([
            { path: 'kokpit/ui/z.tsx', content: '<span>Kayıt</span>\n' },
            { path: 'kokpit/a/__tests__/z.test.ts', content: 'describe.skip("x", () => {});\n' },
            { path: 'src/bad.css', content: '.x { color: #123456; }\n' },
        ], [group('Dilim A', [{ id: '#1', status: 'done' }])]));
        const rank = { error: 3, warning: 2, note: 1 } as const;
        const severities = violations.map((violation) => rank[violation.severity]);
        for (let index = 1; index < severities.length; index += 1) {
            expect(severities[index as number] as number).toBeLessThanOrEqual(severities[index - 1] as number);
        }
        const ids = violations.map((violation) => violation.id);
        expect(violations[0]?.rule).toBe('hex-in-component');
        // Eşit puanlı (warning) kuyrukta sıra id lexicographic'tir.
        const warnings = violations.filter((violation) => violation.severity === 'warning').map((violation) => violation.id);
        expect(warnings).toEqual([...warnings].sort());
    });

    it('id determinizmi: aynı girdide koşumlar arası id birebir aynıdır', () => {
        const ctx = fileCtx([{ path: 'src/a.css', content: '.x { color: #123456; }\n' }], [group('Dilim A', [{ id: '#1', status: 'done' }])]);
        const first = detectRuleViolations(ctx).map((violation) => violation.id);
        const second = detectRuleViolations(ctx).map((violation) => violation.id);
        expect(first).toEqual(second);
    });
});

describe('defter senkronu — near-miss zorunluluğu (UI-SPEC §10.3)', () => {
    const slice = group('Dilim X · Örnek faz', [{ id: '#1', status: 'done', completedAt: '2026-08-01' }]);

    it('faz dosyası dizini yoksa missing + phase-file-missing near-miss', () => {
        const entries = deriveSyncEntries([slice], { phaseFiles: null, handoffFiles: null } satisfies SyncFileSet);
        expect(entries[0]?.phaseFile).toBe('missing');
        expect(entries[0]?.nearMiss?.reasonCode).toBe('phase-file-missing');
        expect(countSyncStale(entries)).toBe(1);
    });

    it('sinyal tarihi kutu tarihinden 7 günden gerideyse date-gap near-miss', () => {
        const entries = deriveSyncEntries([slice], {
            phaseFiles: [{ name: 'slice.md', content: '## Faz UYGULANDI — 2026-07-10 ✅\n\nGövde notu.\n' }],
            handoffFiles: [{ name: 'handoff-x.md', content: 'Dilim X devir: tamamlandı.\n' }],
        } satisfies SyncFileSet);
        expect(entries[0]?.phaseFile).toBe('stale');
        expect(entries[0]?.nearMiss?.reasonCode).toBe('date-gap');
    });

    it('UYGULANDI sinyali varken kutu açıksa content-hash-mismatch near-miss', () => {
        const openSlice = group('Dilim X · Örnek faz', [{ id: '#1', status: 'open' }]);
        const entries = deriveSyncEntries([openSlice], {
            phaseFiles: [{ name: 'slice.md', content: '## Faz UYGULANDI — 2026-08-20\n\nGövde notu.\n' }],
            handoffFiles: [{ name: 'handoff-x.md', content: 'Dilim X devir.\n' }],
        } satisfies SyncFileSet);
        expect(entries[0]?.nearMiss?.reasonCode).toBe('content-hash-mismatch');
    });

    it('handoff dosyaları varsa ama dilim anılmıyorsa partial dürüst kaydı düşer', () => {
        const entries = deriveSyncEntries([slice], {
            phaseFiles: [{ name: 'slice.md', content: '## Faz UYGULANDI — 2026-08-05 ✅\n\nGövde.\n' }],
            handoffFiles: [{ name: 'handoff-other.md', content: 'Başka çalışma; bu dilime atıf yok.\n' }],
        } satisfies SyncFileSet);
        expect(entries[0]?.handoff).toBe('partial');
    });
});

describe('karar bütünlüğü — çelişki adayları (UI-SPEC §10.5, yarım-otomatik)', () => {
    const ctx = {
        planText: [
            '# Plan',
            '',
            '## Konu',
            '',
            'Türkçe ikinci sorgu, DergiPark ve YÖK tez korpusu değildir; yerel paket açık yoldur.',
            '',
            '## Başka',
            '',
            '- [x] normal madde',
        ].join('\n'),
        planPath: 'ROADMAP.md',
        ledgerText: [
            '# Karar Defteri',
            '',
            '### D4-I · Korpus erişimi',
            '',
            '**Durum:** ✅ KARAR (2026-08-22) → B · Erişimi genişlet; tez ve yeni bağlayıcı gelir, korpus ölçümü açılır.',
        ].join('\n'),
        ledgerPath: '.agents/karar-defteri.md',
        fallbackDate: '2026-08-27',
    };

    it('negasyon cümlesi × genişletici karar: kesişim ≥2 → open-conflict', () => {
        const conflicts = detectConflicts(ctx);
        expect(conflicts.length).toBeGreaterThanOrEqual(1);
        const first = conflicts[0];
        expect(first?.status).toBe('open-conflict');
        expect(first?.authorityA).toContain('ROADMAP.md · L5');
        expect(first?.authorityB).toContain('karar-defteri.md');
        expect(first?.observedAtB).toBe('2026-08-22');
        expect(first?.suggestion).toContain('superseded-note');
    });

    it('karar defteri yoksa çelişki üretilmez — uydurma yapılmaz', () => {
        expect(detectConflicts({ ...ctx, ledgerText: null })).toEqual([]);
    });

    it('superseded zinciri kronolojisi bozuksa ayrı bütünlük kaydı üretir', () => {
        const ledger = [
            '### Yeni · Kural sürümü',
            '',
            '**Durum:** ✅ KARAR (2026-08-01) → eski kuralı yürürlükten kaldırır.',
            '',
            '### Eski · Kural',
            '',
            '**Durum:** ✅ KARAR (2026-08-10) → yürürlükte.',
        ].join('\n');
        const chains = detectBrokenSupersededChains({ ...ctx, ledgerText: ledger });
        expect(chains).toHaveLength(1);
        expect(chains[0]?.status).toBe('superseded-chain');
    });
});

describe('buildCompliance — uçtan uca ve dürüstlük', () => {
    const tempRoots: string[] = [];

    afterEach(() => {
        for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    it('github kaynağında unmeasured rapor: boş liste temiz gibi SUNULAMAZ', async () => {
        const record = {
            id: 'github-x',
            source: { type: 'github', owner: 'octocat', repo: 'Hello-World', htmlUrl: 'https://github.com/octocat/Hello-World', private: false },
            index: {},
        } as unknown as Parameters<typeof buildCompliance>[0];
        const report = await buildCompliance(record, { now: () => new Date(RECEIPT_DATE) });
        expect(report.measurement).toBe('unmeasured');
        expect(report.reasons[0]?.code).toBe('no-local-checkout');
        expect(report.violations).toEqual([]);
        expect(report.health.vioErr).toBe(0);
    });

    it('yerel kök ölçümü: ihlal + senkron + sağlık bantları aynı raporda; deterministik', async () => {
        const root = mkdtempSync(join(tmpdir(), 'kokpit-compliance-'));
        tempRoots.push(root);
        const plan = '# Plan\n\n## Dilim A\n\n- [x] **Bir**\n- [x] **İki**\n';
        writeFileSync(join(root, 'PLAN.md'), plan);
        writeFileSync(join(root, 'bad.css'), '.x { color: #123456; }\n');
        mkdirSync(join(root, '.agents', 'phases'), { recursive: true });
        writeFileSync(join(root, '.agents', 'phases', 'a.md'), '## Faz\n\nGövde notu; başlıkta tarihli durum yok.\n');
        const record = {
            id: 'local-x',
            source: { type: 'local', root },
            index: { planPath: 'PLAN.md', planMarkdown: plan, indexedAt: RECEIPT_DATE },
        } as unknown as Parameters<typeof buildCompliance>[0];
        const first = await buildCompliance(record, { now: () => new Date(RECEIPT_DATE) });
        const second = await buildCompliance(record, { now: () => new Date(RECEIPT_DATE) });
        const strip = (report: typeof first) => JSON.stringify({ ...report, generatedAt: '' });
        expect(strip(first)).toBe(strip(second));
        expect(first.measurement).toBe('measured');
        expect(first.violations.some((violation) => violation.rule === 'hex-in-component')).toBe(true);
        expect(first.health.phaseDone).toBe(2);
        expect(first.health.open).toBe(0);
        expect(first.health.vioErr).toBe(1);
        expect(first.sync[0]?.nearMiss?.reasonCode).toBe('version-field-missing');
    });

    it('kök okunamazsa root-unreadable nedeniyle unmeasured döner', async () => {
        const record = {
            id: 'local-gone',
            source: { type: 'local', root: join(tmpdir(), `kokpit-missing-${Date.now()}`) },
            index: { planPath: 'PLAN.md', planMarkdown: '', indexedAt: RECEIPT_DATE },
        } as unknown as Parameters<typeof buildCompliance>[0];
        const report = await buildCompliance(record, { now: () => new Date(RECEIPT_DATE) });
        expect(report.measurement).toBe('unmeasured');
        expect(report.reasons[0]?.code).toBe('root-unreadable');
    });
});
