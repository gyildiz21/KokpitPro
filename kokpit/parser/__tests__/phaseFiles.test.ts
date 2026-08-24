import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { readFileSync } from 'fs';
import { scanPhaseFileText } from '../phaseFiles';

const FIXTURE = join(__dirname, '__fixtures__', 'faz-dosyasi-ornek.md');

describe('scanPhaseFileText — sözleşme (S1I gerçek kesiti)', () => {
    const text = readFileSync(FIXTURE, 'utf8');
    const scan = scanPhaseFileText(text, 'faz-dosyasi-ornek.md');
    const byHeading = (needle: string) =>
        scan.signals.find((s) => s.heading.includes(needle));

    it('UYGULANDI başlıkları tarihle yakalanır', () => {
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
