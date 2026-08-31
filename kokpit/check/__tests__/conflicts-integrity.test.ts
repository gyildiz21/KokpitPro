// Dilim 5.2 · Çelişki motoru sertleştirmesi nöbetçileri.
// Bütün örnekler sentetik ve anonimdir; gerçek korpus içeriği taşımaz.

import { describe, expect, it } from 'vitest';
import { detectConflicts, evaluateConflicts, type ConflictContext } from '../conflicts';

function ctxWith(planText: string, ledgerText: string): ConflictContext {
    return {
        planText,
        planPath: 'ROADMAP.md',
        ledgerText,
        ledgerPath: '.agents/karar-defteri.md',
        fallbackDate: '2026-08-27',
    };
}

describe('çelişki sertleştirmesi — jenerik token ve yön kuralları (Dilim 5.2)', () => {
    it('yalnız jenerik ortak tokenlar (2026, adı, açık, backend) aday üretmez', () => {
        const ctx = ctxWith(
            [
                '# Plan',
                '',
                '**Son Güncelleme:** 2026-08-04',
                '',
                '## Konu',
                '',
                'Backend arayüz adı 2026 açık form değildir.',
            ].join('\n'),
            [
                '# Karar Defteri',
                '',
                '### Genel bölüm',
                '',
                '**Durum:** ✅ KARAR (2026-09-01) → Backend adını 2026 açık form ile genişlet.',
            ].join('\n'),
        );
        expect(detectConflicts(ctx)).toEqual([]);
        expect(evaluateConflicts(ctx).rejectionCounts['generic-token-only']).toBe(1);
    });

    it('salt kelime kesişimi çelişki değildir: iki taraf da genişleticiyse aday yok', () => {
        const ctx = ctxWith(
            'Tez korpusu ve ölçüm kapsamı genişletilir; bağlayıcı gelir.',
            [
                '# Karar Defteri',
                '',
                '### Ölçüm bölümü',
                '',
                '**Durum:** ✅ KARAR (2026-09-01) → Tez korpusunu ve ölçüm kapsamını genişlet.',
            ].join('\n'),
        );
        expect(detectConflicts(ctx)).toEqual([]);
        expect(evaluateConflicts(ctx).scannedScope.planStatements).toBe(0);
    });

    it('kısıt cümlesi + sonraki tarihli genişletici KARAR + ≥2 ayırt edici token → aday; id/tarih/yön doğru', () => {
        const ctx = ctxWith(
            [
                '# Plan',
                '',
                '**Son Güncelleme:** 2026-08-04',
                '',
                '## Konu',
                '',
                'Hazır tez korpusu bağlayıcı değildir; kapsam yerel ölçümle sınırlıdır.',
            ].join('\n'),
            [
                '# Karar Defteri',
                '',
                '### Ölçüm bölümü',
                '',
                '**Durum:** ✅ KARAR (2026-08-22) → Tez korpusunu ve bağlayıcıyı genişlet; ölçüm açılır.',
            ].join('\n'),
        );
        const conflicts = detectConflicts(ctx);
        expect(conflicts).toHaveLength(1);
        const candidate = conflicts[0];
        expect(candidate?.id).toBe('conflict:bağlayıcı-korpusu:roadmap-md:agents-karar-defteri-md');
        expect(candidate?.topic).toBe('bağlayıcı, korpusu (kısıt→genişletme)');
        expect(candidate?.observedAtA).toBe('2026-08-04');
        expect(candidate?.observedAtB).toBe('2026-08-22');
        expect(candidate?.authorityA).toContain('ROADMAP.md · L7');
        expect(candidate?.authorityB).toContain('karar-defteri.md · L');
    });

    it('aynı jenerik sözcükleri içeren İLGİSİZ karar bölümü aday üretmez', () => {
        const ctx = ctxWith(
            [
                '# Plan',
                '',
                '**Son Güncelleme:** 2026-08-04',
                '',
                '## Konu',
                '',
                'Hazır tez korpusu bağlayıcı değildir; kapsam yerel ölçümle sınırlıdır.',
            ].join('\n'),
            [
                '# Karar Defteri',
                '',
                '### Korpus panosu',
                '',
                '**Durum:** ✅ KARAR (2026-08-25) → Yeni bakım penceresi genişletildi; pano tazelendi.',
            ].join('\n'),
        );
        expect(detectConflicts(ctx)).toEqual([]);
        expect(evaluateConflicts(ctx).rejectionCounts['unrelated-flow']).toBe(1);
    });

    it('lider-içi düzeltme: eski kısıt KARAR → yeni genişletici KARAR aday üretir', () => {
        const ctx = ctxWith(
            '# Plan\n\n## Not\n\nDüzeltme akışı izlenir.\n',
            [
                '# Karar Defteri',
                '',
                '### Kart · Ölçüm aralığı',
                '',
                '**Durum:** ✅ KARAR (2026-08-01) → Ölçüm korpusu dış bağlayıcı eklenmez; yerel paket yeterlidir.',
                '',
                '### DÜZELTİLMİŞ KART · Ölçüm aralığı',
                '',
                '**Durum:** ✅ KARAR (2026-08-20) → Ölçüm korpusu dış bağlayıcıyı genişlet; uzak paket devreye alınır.',
            ].join('\n'),
        );
        const conflicts = detectConflicts(ctx);
        expect(conflicts).toHaveLength(1);
        const candidate = conflicts[0];
        expect(candidate?.id).toBe('conflict:bağlayıcı-korpusu-paket:agents-karar-defteri-md:duzeltme');
        expect(candidate?.id.endsWith(':duzeltme')).toBe(true);
        expect(candidate?.observedAtA).toBe('2026-08-01');
        expect(candidate?.observedAtB).toBe('2026-08-20');
        expect(candidate?.authorityA).toContain('Kart · Ölçüm aralığı');
        expect(candidate?.authorityB).toContain('DÜZELTİLMİŞ KART');
        expect(candidate?.topic).toContain('(kısıt→genişletme)');
    });

    it('lider-içi düzeltmede kronoloji tersse aday üretilmez', () => {
        const ctx = ctxWith(
            '# Plan\n\n## Not\n\nDüzeltme akışı izlenir.\n',
            [
                '# Karar Defteri',
                '',
                '### Kart · Ölçüm aralığı',
                '',
                '**Durum:** ✅ KARAR (2026-08-20) → Ölçüm korpusu dış bağlayıcı eklenmez; yerel paket yeterlidir.',
                '',
                '### DÜZELTİLMİŞ KART · Ölçüm aralığı',
                '',
                '**Durum:** ✅ KARAR (2026-08-01) → Ölçüm korpusu dış bağlayıcıyı genişlet; uzak paket devreye alınır.',
            ].join('\n'),
        );
        expect(detectConflicts(ctx)).toEqual([]);
        expect(evaluateConflicts(ctx).rejectionCounts['chronology-invalid']).toBe(1);
    });

    it('determinizm: aynı girdi iki koşumda birebir aynı id listesini üretir', () => {
        const ctx = ctxWith(
            [
                '# Plan',
                '',
                '**Son Güncelleme:** 2026-08-04',
                '',
                'Hazır tez korpusu bağlayıcı değildir.',
            ].join('\n'),
            [
                '# Karar Defteri',
                '',
                '### Ölçüm bölümü',
                '',
                '**Durum:** ✅ KARAR (2026-08-22) → Tez korpusunu ve bağlayıcıyı genişlet; ölçüm açılır.',
            ].join('\n'),
        );
        const first = detectConflicts(ctx).map((entry) => entry.id);
        const second = detectConflicts(ctx).map((entry) => entry.id);
        expect(first).toEqual(second);
    });

    it('aynı cümlede genişletme işaretleyicisi olmayan karar aday üretmez', () => {
        const ctx = ctxWith(
            [
                '# Plan',
                '',
                '**Son Güncelleme:** 2026-08-04',
                '',
                'Hazır tez korpusu bağlayıcı değildir.',
            ].join('\n'),
            [
                '# Karar Defteri',
                '',
                '### Ölçüm bölümü',
                '',
                '**Durum:** ✅ KARAR (2026-08-22) → Korpus bağlayıcı aracın bakımı yapılır; yerinde kalır.',
            ].join('\n'),
        );
        expect(detectConflicts(ctx)).toEqual([]);
        const evaluation = evaluateConflicts(ctx);
        expect(
            evaluation.rejectionCounts['no-expansive-direction'] +
            evaluation.rejectionCounts['repeated-restriction'] +
            evaluation.rejectionCounts['unrelated-flow'] +
            evaluation.rejectionCounts['weak-topic-overlap'] +
            evaluation.rejectionCounts['generic-token-only'],
        ).toBeGreaterThanOrEqual(1);
    });
});
