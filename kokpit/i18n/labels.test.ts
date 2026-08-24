// D1 nöbetçisi — sözlük disiplini.
//
// 1) tr/en anahtar paritesi: bir dile eklenen her anahtar ötekinde de olmak
//    zorunda (derlemede `en: Dict` zaten zorlar; bu test çalışma anını ve
//    gelecekteki iç içe yapıları da korur).
// 2) Değerlerin boş olmaması: "çevrilmemiş" sessizce boş string bırakılamaz.

import { describe, expect, it } from 'vitest';
import { LABELS, type Lang } from '../i18n/labels';

function keyPaths(obj: unknown, prefix = ''): string[] {
    if (obj === null || typeof obj !== 'object') return [prefix];
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
        keyPaths(v, prefix ? `${prefix}.${k}` : k),
    );
}

const LANGS: Lang[] = ['tr', 'en'];

describe('D1 — i18n sözlük paritesi', () => {
    it('tr ve en aynı anahtar kümesine sahiptir', () => {
        const trKeys = keyPaths(LABELS.tr).sort();
        const enKeys = keyPaths(LABELS.en).sort();
        expect(enKeys).toEqual(trKeys);
    });

    it('hiçbir değer boş değildir (çevrilmemiş sessizlik yasak)', () => {
        for (const lang of LANGS) {
            for (const path of keyPaths(LABELS[lang])) {
                // yaprak değeri oku
                let cur: unknown = LABELS[lang];
                for (const seg of path.split('.')) {
                    cur = (cur as Record<string, unknown>)[seg];
                }
                expect(typeof cur === 'string' && cur.length > 0, `${lang}:${path} boş`).toBe(true);
            }
        }
    });

    it('varsayılan dil TR örnekleri sabittir (terminoloji kayması nöbeti)', () => {
        expect(LABELS.tr.itemStatus.done).toBe('Kodlandı');
        expect(LABELS.tr.itemStatus.partial).toBe('Sürüyor');
        expect(LABELS.tr.statusToken.WAITING_HUMAN).toBe('İnsan adımı bekliyor');
    });
});
