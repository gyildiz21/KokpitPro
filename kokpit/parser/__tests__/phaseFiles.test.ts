import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { readFileSync } from 'fs';
import { scanPhaseFileText } from '../phaseFiles';
import { StatusToken } from '../schema';

const FIXTURE = join(__dirname, '__fixtures__', 'faz-dosyasi-ornek.md');

describe('scanPhaseFileText — sözleşme (S1I gerçek kesiti)', () => {
    const text = readFileSync(FIXTURE, 'utf8');
    const scan = scanPhaseFileText(text, 'faz-dosyasi-ornek.md');
    const byHeading = (needle: string) =>
        scan.signals.find((s) => s.heading.includes(needle));

    it('UYGULANDI başlıkları tarihle yakalanır', () => {
        expect(scan.schemaVersion).toBe(1);
        const d0 = byHeading('D0 UYGULANDI');
        expect(d0?.token).toBe('UYGULANDI');
        expect(d0?.date).toBe('2026-08-17');
        expect(byHeading('D1 UYGULANDI')?.date).toBe('2026-08-17');
    });

    it('DÜZELTME, UYGULANDI\u2019dan spesifik olduğu için D2\u2019de kazanır', () => {
        // Not: öncelik sırasında UYGULANDI daha önce; "DÜZELTMESİ" UYGULANDI
        // İÇERMEZ — bu yüzden DÜZELTME doğal olarak eşleşir.
        expect(byHeading('D2 DÜZELTMESİ')?.token).toBe('DUZELTME');
    });

    it('D4: RUNTIME + UYGULANDI + GO birlikte — öncelik UYGULANDI\u2019yı seçer', () => {
        const d4 = byHeading('D4 RUNTIME');
        expect(d4?.token).toBe('UYGULANDI');
    });

    it('DOCS_LOCK ve WAITING_HUMAN özel tokenlardır', () => {
        expect(byHeading('Faz 8')?.token).toBe('DOCS_LOCK');
        expect(byHeading('D5-B')?.token).toBe('WAITING_HUMAN'); // GO değil!
    });

    it('WAITING_HUMAN Türkçe ASCII ve noktalı İ yazımlarını tanır', () => {
        expect(scanPhaseFileText('## İNSAN BEKLIYOR\n').signals[0]?.token).toBe('WAITING_HUMAN');
        expect(scanPhaseFileText('## İNSAN BEKLİYOR\n').signals[0]?.token).toBe('WAITING_HUMAN');
    });

    it('durumsuz başlık sessizce atlanır (uydurma yok)', () => {
        // "D4-F — CANLI KUSUR VE ONARIMI" hiçbir token taşımaz → sinyal YOK.
        expect(scan.signals.some((s) => s.heading.includes('D4-F'))).toBe(false);
    });

    it('başlık olmayan "> **Runtime durumu**" satırı taranmaz', () => {
        expect(
            scan.signals.some((s) => s.heading.includes('Runtime durumu')),
        ).toBe(false);
    });
});

describe('K3 — hassasiyet korumaları (hazirlik-auditi §1.5)', () => {
    it('olumsuzlama: "plan değildir" PLAN üretmez', () => {
        const s = scanPhaseFileText(
            '## Kapanmayan tek madde — `MS-REV` hâlâ **plan değildir**\n',
        );
        expect(s.signals).toHaveLength(0);
    });

    it('yapısal istisna: "Runtime açma kapısı" RUNTIME üretmez', () => {
        const s = scanPhaseFileText('#### Runtime açma kapısı\n');
        expect(s.signals).toHaveLength(0);
    });

    it('DUZELTME emoji/tarihsiz konu-başlığında düşer', () => {
        const s = scanPhaseFileText('### Görev 1.1 — Storage Rules Düzeltmesi (KRİTİK)\n');
        expect(s.signals).toHaveLength(0);
    });

    it('DUZELTME tarihli başlıkta geçerli kalır', () => {
        const s = scanPhaseFileText('#### 🔴 D2 DÜZELTMESİ — 2026-08-18 · KS.907–913\n');
        expect(s.signals[0]).toMatchObject({ token: 'DUZELTME', date: '2026-08-18' });
    });

    it('PLAN tokenı kaldırıldı: "Dilim Planı" artık sinyal üretmez', () => {
        const s = scanPhaseFileText('# MS-REV — Dilim Planı · Sıra, Sahiplik ve Tahmin\n');
        expect(s.signals).toHaveLength(0);
        expect(StatusToken.safeParse('PLAN').success).toBe(false);
    });
});
