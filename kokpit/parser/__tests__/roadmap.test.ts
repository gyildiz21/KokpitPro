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
        expect(scan.schemaVersion).toBe(1);
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

    it('K2: sayaç faz-kapsamlıdır — her grup madde-1\u2019den başlar', () => {
        const scan = scanRoadmapText(
            '## A\n\n- [x] **X:** ok\n\n## B\n\n- [ ] **Y:** bekliyor\n',
        );
        // Hata geçmişi: sayaç dosya-geneliydi; erken satır ekleme sonraki
        // fazların kimliklerini kaydırıp Dilim 3 delta'yı kırıyordu.
        expect(scan.groups.map((g) => g.items[0]?.id)).toEqual(['madde-1', 'madde-1']);
        const compositeKeys = scan.groups.flatMap((group) =>
            group.items.map((item) => `${group.heading}::${item.id}`),
        );
        expect(new Set(compositeKeys).size).toBe(compositeKeys.length);
    });

    it('çok satırlı bold başlığı kırpmadan birleştirir', () => {
        const scan = scanRoadmapText(
            '## A\n\n- [ ] **Çok satıra yayılan\n  akademik doğruluk kapısı:** açıklama\n',
        );
        expect(scan.groups[0]?.items[0]?.title).toBe('Çok satıra yayılan akademik doğruluk kapısı');
    });

    it('faz içindeki açık GO kapısını satırıyla birlikte korur', () => {
        const scan = scanRoadmapText('## Dilim 0\n\nHarici GO bekliyor.\n\n- [ ] motor kabulü\n');
        expect(scan.groups[0]).toMatchObject({ gateStatus: 'waiting-go', gateLine: 3 });
    });

    it('madde gövdesindeki sözlük anımı kapı sanmaz (Dilim 2 lejant nöbetçisi)', () => {
        const text = [
            '## Dilim 2 · Harita',
            '',
            '- [x] **Renk ve etkileşim:** kodlandı(yeşil) / sürüyor(amber) / planda(gri) / GO bekliyor(mavi halka) yalnız --st-* belirteçleriyle',
            '  devam satırı; gövdede kalır.',
            '- [ ] başka madde',
        ].join('\n');
        const scan = scanRoadmapText(text);
        expect(scan.groups[0]?.gateStatus).toBeUndefined();
        expect(scan.groups[0]?.gateLine).toBeUndefined();
    });

    it('boş satırdan sonraki bağımsız durum bildirimi yeniden kapı üretir', () => {
        const text = '## F\n\n- [x] biten iş\n\nDurum: harici GO bekleniyor.\n';
        const scan = scanRoadmapText(text);
        expect(scan.groups[0]).toMatchObject({ gateStatus: 'waiting-go' });
        expect(scan.groups[0]?.gateLine).toBe(5);
    });

    it('scanRoadmapPath dizindeki .md dosyalarını tarar', () => {
        const results = scanRoadmapPath(join(__dirname, '__fixtures__'));
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.some((r) => r.sourceFile.endsWith('roadmap-ornek.md'))).toBe(true);
    });
});

describe('Dilim 5 vs Dilim 5.2 — parser kimlik nöbetçisi (PLAN.md §Dilim 5.2 / UI-SPEC §10.9.4)', () => {
    // Sentetik PLAN kesiti: üst dilim "Dilim 5" ile alt dilim "Dilim 5.2"
    // yan yana; 5.2'nin maddeleri AÇIK ([ ]) kabul durumundadır. UI'nin
    // faz kimliği sözleşmesi `Dilim-N`'dir (phaseIdFromHeading ile aynı).
    const HEADING_5 = 'Dilim 5 · Uyum Telemetrisi';
    const HEADING_52 = 'Dilim 5.2 · Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit';
    const PHASE_ID_RE = /^Dilim\s+([0-9]+(?:\.[0-9]+)?)/i;

    const text = [
        '# Plan',
        '',
        `## ${HEADING_5}`,
        '',
        '- [x] **Uyum kuyruğu:** kodlandı — **Tamamlandı 2026-08-28**',
        '- [ ] Gerçek korpus kabulü',
        '',
        `## ${HEADING_52}`,
        '',
        '- [ ] **5.2.0 — Sözleşme dondurma:** ExplanationEnvelope v1',
        '- [ ] **#5.2 özel kimlikli madde:** alt dilim kimliği gölgelenmez',
        '',
    ].join('\n');

    const scan = scanRoadmapText(text, 'PLAN.md');

    it('iki AYRI grup üretir; alt dilim üst dilimin grubuna eritilmez', () => {
        expect(scan.groups).toHaveLength(2);
        expect(scan.groups.map((g) => g.heading)).toEqual([HEADING_5, HEADING_52]);
    });

    it('grup kimlikleri Dilim-5 ve Dilim-5.2 olarak ayrışır; önek benzerliği karışım yaratmaz', () => {
        const ids = scan.groups.map((g) => {
            const match = PHASE_ID_RE.exec(g.heading);
            return `Dilim-${match?.[1] ?? ''}`;
        });
        // 'Dilim-5.2' dizgesi 'Dilim-5' ile başlar: kimlik eşitliği asla
        // önek karşılaştırması olamaz; iki kimlik birbirinden farklıdır.
        expect(ids).toEqual(['Dilim-5', 'Dilim-5.2']);
        expect(new Set(ids).size).toBe(2);
        expect(ids[1]?.startsWith('Dilim-5')).toBe(true); // tuzak gerçekten vardır…
        expect(ids[0]).not.toBe(ids[1]); // …ve nöbetçi ona rağmen ayrıştırır
    });

    it('madde id\u2019leri grup başına sıfırlanır; iki gruptaki madde-1 çakışma karışımı yaratmaz', () => {
        const [g5, g52] = scan.groups;
        expect(g5?.items.map((item) => item.id)).toEqual(['madde-1', 'madde-2']);
        expect(g52?.items.map((item) => item.id)).toEqual(['madde-1', '#5.2']);
        // Bileşik kimlik (faz başlığı :: madde id) evrensel olarak tekildir:
        // aynı madde-1 iki farklı fazın deltasına sızmaz (Dilim 3 sözleşmesi).
        const compositeKeys = scan.groups.flatMap((group) =>
            group.items.map((item) => `${group.heading}::${item.id}`),
        );
        expect(new Set(compositeKeys).size).toBe(compositeKeys.length);
        expect(compositeKeys).toContain(`${HEADING_5}::madde-1`);
        expect(compositeKeys).toContain(`${HEADING_52}::madde-1`);
    });

    it('Dilim 5.2 açık kabul durumundayken de gruba dahildir; maddeleri görünürdür', () => {
        const g52 = scan.groups.find((g) => g.heading === HEADING_52);
        expect(g52).toBeDefined();
        expect(g52?.items).toHaveLength(2);
        expect(g52?.items.every((item) => item.status === 'open')).toBe(true);
        // Maddeler üst dilimin başlığına değil KENDİ başlığına işaret eder.
        for (const item of g52?.items ?? []) {
            expect(item.phaseHeading).toBe(HEADING_52);
            expect(item.phaseHeading).not.toBe(HEADING_5);
        }
        // Açık kabul ≠ motor yapılmadı: madde satırları kayıpsız listelenir.
        expect(g52?.items.map((item) => item.title)).toEqual([
            '5.2.0 — Sözleşme dondurma',
            '#5.2 özel kimlikli madde',
        ]);
    });
});
