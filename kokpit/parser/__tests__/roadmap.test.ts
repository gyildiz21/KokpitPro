import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { readFileSync } from 'fs';
import { scanRoadmapText, scanRoadmapPath } from '../roadmap';

const FIXTURE = join(__dirname, '__fixtures__', 'roadmap-ornek.md');

describe('scanRoadmapText — sözleşme (MethodLogos gerçek kesiti)', () => {
    const text = readFileSync(FIXTURE, 'utf8');
    const scan = scanRoadmapText(text, 'roadmap-ornek.md');
    const p0 = scan.groups.find((g) => g.heading.startsWith('P0'));
    const p1 = scan.groups.find((g) => g.heading.startsWith('P1'));

    it('iki faz grubu bulur', () => {
        expect(scan.groups).toHaveLength(2);
        expect(p0).toBeDefined();
        expect(p1).toBeDefined();
    });

    it('P0: 2 done + 1 open; tarihler doğru', () => {
        expect(p0?.items).toHaveLength(3);
        expect(p0?.items[0]).toMatchObject({
            id: '#1',
            status: 'done',
            completedAt: '2026-07-17',
            phaseHeading: expect.stringContaining('P0'),
        });
        expect(p0?.items[1]?.completedAt).toBe('2026-07-17');
        // Devam satırındaki tarih ilk maddenin değil, kendi bloğunun tarihi.
        expect(p0?.items[0]?.title).toBe('#1 Konsensüs körlüğünü gider');
        expect(p0?.items[2]?.status).toBe('open');
        expect(p0?.items[2]?.id).toBe('madde-3'); // # kimliği yok → sıradan
    });

    it('P1: [~] partial durumu; küçük harfli "tamamlandı" da yakalanır; bold\u2019suz başlık kesilir', () => {
        expect(p1?.items).toHaveLength(3);
        expect(p1?.items.every((i) => i.status === 'partial' || i.status === 'open')).toBe(true);
        expect(p1?.items[1]?.status).toBe('partial');
        expect(p1?.items[1]?.completedAt).toBe('2026-07-22');
        expect(p1?.items[2]?.title).toBe('Filtrelerin gerçek olması');
        expect(p1?.items[2]?.status).toBe('open');
    });

    it('satır numaraları kaynağa işaret eder (geri izlenebilirlik)', () => {
        for (const g of scan.groups) {
            for (const item of g.items) {
                const src = text.split(/\r?\n/)[item.line - 1] ?? '';
                expect(src).toContain('- [');
            }
        }
    });

    it('çıktı Zod şemasından geçer (kendi sözleşmesiyle kendini vurur)', () => {
        expect(() => scanRoadmapText(text)).not.toThrow();
    });
});

describe('kenar durumlar', () => {
    it('checkbox içermeyen metin boş grup döndürür, patlamaz', () => {
        const scan = scanRoadmapText('# Başlık\n\nsadece paragraf.\n');
        expect(scan.groups).toHaveLength(0);
    });

    it('## Dilim N tarzı düz faz dosyaları ayrı gruplara ayrılır (dış denetim bulgusu)', () => {
        const scan = scanRoadmapText(
            [
                '# Plan',
                '',
                '## Dilim 0',
                '',
                '- [ ] a işi',
                '',
                '## Dilim 1',
                '',
                '- [x] **B:** yapıldı — **Tamamlandı 2026-01-02**',
                '',
            ].join('\n'),
        );
        // Hata geçmişi: ## başlıklar yalnız ilk grupta sınır sayılıyor,
        // Dilim 1–4 maddeleri Dilim 0'a yığılıyordu.
        expect(scan.groups.map((g) => g.heading)).toEqual(['Dilim 0', 'Dilim 1']);
        expect(scan.groups[0]?.items).toHaveLength(1);
        expect(scan.groups[0]?.items[0]?.status).toBe('open');
        expect(scan.groups[1]?.items[0]?.status).toBe('done');
        expect(scan.groups[1]?.items[0]?.completedAt).toBe('2026-01-02');
    });

    it('## başlığıyla başlayan dosya ## altına toplar', () => {
        const scan = scanRoadmapText('## Üst\n\n- [x] **A:** yapıldı — **Tamamlandı 2026-01-01**\n');
        expect(scan.groups).toHaveLength(1);
        expect(scan.groups[0]?.heading).toBe('Üst');
        expect(scan.groups[0]?.items[0]?.status).toBe('done');
    });

    it('scanRoadmapPath dizindeki .md dosyalarını tarar', () => {
        const results = scanRoadmapPath(join(__dirname, '__fixtures__'));
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.some((r) => r.sourceFile.endsWith('roadmap-ornek.md'))).toBe(true);
    });
});
