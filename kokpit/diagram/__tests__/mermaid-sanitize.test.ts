// Dilim 2.0 adım 3 nöbetçileri: Mermaid temizleme/doğrulama katmanı.
// Odak: enjeksiyon kapalılığı, determinizm, Unicode/Türkçe korunumu.

import { describe, expect, it } from 'vitest';
import {
    MAX_LABEL_LENGTH,
    buildFileLink,
    escapeMermaidLabel,
    safeMermaidId,
    validateMermaidSource,
} from '../mermaid-sanitize';

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Etiketi gerçek derleyici gibi tırnaklı düğüm satırına çevirir. */
function quotedNode(id: string, label: string): string {
    return `${id}["${escapeMermaidLabel(label)}"]`;
}

function composeSource(labels: readonly string[]): string {
    const ids = labels.map((label) => safeMermaidId(label));
    const lines = ['flowchart TD'];
    for (const [index, id] of ids.entries()) {
        lines.push(quotedNode(id, labels[index] ?? ''));
        if (index > 0) {
            const previous = ids[index - 1];
            if (previous !== undefined) {
                lines.push(`${previous} --> ${id}`);
            }
        }
    }
    const first = ids[0];
    if (first !== undefined) {
        lines.push(
            `click ${first} "https://github.com/acme/demo/blob/main/src/a.ts"`,
        );
    }
    return lines.join('\n');
}

describe('safeMermaidId', () => {
    it('aynı ham girdi iki koşumda aynı kimliği üretir (determinizm)', () => {
        expect(safeMermaidId('Kullanıcı Girişi')).toBe(
            safeMermaidId('Kullanıcı Girişi'),
        );
        expect(safeMermaidId('')).toBe(safeMermaidId(''));
    });

    it('çıktı her zaman ^[a-z][a-z0-9_]*$ desenine uyar', () => {
        const samples = ['', '   ', 'Örnek Başlık!', '123 servis', 'ş-ğ-ü', 'A.B/C'];
        for (const sample of samples) {
            expect(ID_PATTERN.test(safeMermaidId(sample))).toBe(true);
        }
    });

    it('farklı ham girdiler farklı kimlik üretir (çarpışma nöbetçisi)', () => {
        // Bu dörtlü aynı sluga düşer; hash soneki ayrıştırmalı.
        const raws = ['A B', 'A-B', 'a/b', 'a.b'];
        const ids = raws.map((raw) => safeMermaidId(raw));
        for (let i = 0; i < ids.length; i += 1) {
            for (let j = i + 1; j < ids.length; j += 1) {
                expect(ids[i]).not.toBe(ids[j]);
            }
        }
        expect(new Set(ids).size).toBe(raws.length);
    });

    it('Türkçe karakterler anlamlı sluga düşer', () => {
        const id = safeMermaidId('Örnek Başlık');
        expect(id.startsWith('ornek_baslik_')).toBe(true);
        expect(ID_PATTERN.test(id)).toBe(true);
    });

    it('rakamla başlayan ve boş girdiler yine geçerli kimlik verir', () => {
        expect(safeMermaidId('123 servis').startsWith('n_123_servis_')).toBe(true);
        expect(safeMermaidId('\u200B\u202E').startsWith('node_')).toBe(true);
    });
});

describe('escapeMermaidLabel — HTML/JS enjeksiyonu', () => {
    it('<script> etkisizleşir', () => {
        const label = escapeMermaidLabel('<script>alert(1)</script>');
        expect(label).not.toMatch(/<script/i);
        expect(label).toContain('#60;');
        const source = `flowchart TD\n${quotedNode('n0_x', '<script>alert(1)</script>')} --> B`;
        expect(validateMermaidSource(source)).toEqual({ ok: true });
    });

    it('<img onerror> etkisizleşir', () => {
        const label = escapeMermaidLabel('<img src=x onerror=alert(1)>');
        expect(label).not.toContain('<');
        expect(label).toContain('#60;img');
        const source = `flowchart TD\n${quotedNode('n0_x', '<img src=x onerror=alert(1)>')} --> B`;
        expect(validateMermaidSource(source)).toEqual({ ok: true });
    });
});

describe('escapeMermaidLabel — satır enjeksiyonu', () => {
    const payloads = [
        'x"\nclick A javascript:alert(1)',
        'x"; call alert();',
        'x\nclassDef evil fill:#ff0000;',
        'x\nsubgraph Evil\nend',
        'x\nstyle A fill:red',
        'x%%{init: {"securityLevel":"loose"}}%%',
    ];

    it('yönerge kaçışları tek satıra iner, tırnağı kıramaz ve kaynak geçerli kalır', () => {
        for (const payload of payloads) {
            const label = escapeMermaidLabel(payload);
            expect(label).not.toMatch(/[\r\n]/);
            // Tırnak hiç kalmadığı için etiket tırnaklı bölgeden çıkamaz.
            expect(label).not.toContain('"');
            const source = `flowchart TD\n${quotedNode('n0_x', payload)} --> B`;
            expect(validateMermaidSource(source)).toEqual({ ok: true });
        }
    });
});

describe('escapeMermaidLabel — tırnak/backtick/parantez dengesi', () => {
    it('denge bozan hiçbir karakter çıktıda literal kalmaz', () => {
        const label = escapeMermaidLabel('He said "hi" (a[b]{c}) `t` | x; %y%');
        expect(label).toMatch(/^He said /);
        for (const ch of ['"', '`', '(', ')', '[', ']', '{', '}', '|', '%']) {
            expect(label).not.toContain(ch);
        }
        // Varlık kodları söküldükten sonra literal ';' kalmaz (ayraç kaçınamaz).
        const withoutEntities = label.replace(/#[^ ;]*;/g, '');
        expect(withoutEntities).not.toContain(';');
        const source = `flowchart TD\n${quotedNode('n0_x', 'He said "hi" (a[b]{c}) `t`')} --> B`;
        expect(validateMermaidSource(source)).toEqual({ ok: true });
    });
});

describe('escapeMermaidLabel — satır sonu ve görünmez karakterler', () => {
    it('CRLF/LF/CR tek boşluğa iner', () => {
        expect(escapeMermaidLabel('a\r\nb\rc')).toBe('a b c');
    });

    it('U+202E RTL override etkisizleşir', () => {
        const label = escapeMermaidLabel('a\u202Eb');
        expect(label).toBe('a b');
        expect(label.includes('\u202e')).toBe(false);
    });

    it('boş/görünmez girdi görünür yedeğe iner (—)', () => {
        expect(escapeMermaidLabel('')).toBe('—');
        expect(escapeMermaidLabel('\u200B\u202E\u00AD')).toBe('—');
    });
});

describe('escapeMermaidLabel — Unicode/Türkçe', () => {
    it('Türkçe metin NFC olarak değişmeden çıkar', () => {
        expect(escapeMermaidLabel('ŞğüİÖÇ — çekirdek')).toBe('ŞğüİÖÇ — çekirdek');
    });

    it('ayrıştırılmış (decomposed) girdi NFC biçimine iner', () => {
        expect(escapeMermaidLabel('S\u0327')).toBe('Ş');
    });
});

describe('escapeMermaidLabel — uzunluk sınırı', () => {
    it(MAX_LABEL_LENGTH + ' karakter üstü kırpılır', () => {
        const label = escapeMermaidLabel('a'.repeat(100));
        expect(label.length).toBe(MAX_LABEL_LENGTH);
    });

    it('kırpma yarım varlık kodunu onarır ve çıktı geçerli kalır', () => {
        const raw = 'a'.repeat(70) + '"<x';
        const label = escapeMermaidLabel(raw);
        expect(label).toBe('a'.repeat(70));
        expect(label).not.toMatch(/#[^; ]*$/);
        const source = `flowchart TD\n${quotedNode('n0_x', raw)} --> B`;
        expect(validateMermaidSource(source)).toEqual({ ok: true });
    });
});

describe('buildFileLink', () => {
    it('temel GitHub blob bağlantısı üretir', () => {
        expect(buildFileLink('https://github.com/acme/demo', 'main', 'src/index.ts')).toBe(
            'https://github.com/acme/demo/blob/main/src/index.ts',
        );
    });

    it('satır numarasını #L hedefi olarak ekler', () => {
        expect(
            buildFileLink('https://github.com/acme/demo', 'main', 'src/a.ts', { line: 42 }),
        ).toBe('https://github.com/acme/demo/blob/main/src/a.ts#L42');
    });

    it('özel karakterli yol kodlanır, dal adındaki / korunur', () => {
        expect(
            buildFileLink(
                'https://github.com/acme/demo/',
                'codex/dilim-2-real-map',
                'src/parser/ş dosya.md',
            ),
        ).toBe(
            'https://github.com/acme/demo/blob/codex/dilim-2-real-map/src/parser/%C5%9F%20dosya.md',
        );
    });

    it('javascript:/data:/ftp: temel adresleri reddeder', () => {
        expect(() => buildFileLink('javascript:alert(1)', 'main', 'a.ts')).toThrow(TypeError);
        expect(() => buildFileLink('data:text/plain,x', 'main', 'a.ts')).toThrow(TypeError);
        expect(() => buildFileLink('ftp://example.com/repo', 'main', 'a.ts')).toThrow(TypeError);
    });

    it('geçersiz yol/dal/satır değerleri reddeder', () => {
        expect(() => buildFileLink('https://github.com/acme/demo', 'main', '')).toThrow(RangeError);
        expect(() => buildFileLink('https://github.com/acme/demo', 'main', '../secret')).toThrow(
            RangeError,
        );
        expect(() => buildFileLink('https://github.com/acme/demo', '', 'a.ts')).toThrow(RangeError);
        expect(() =>
            buildFileLink('https://github.com/acme/demo', 'main', 'a.ts', { line: 0 }),
        ).toThrow(RangeError);
    });

    it('deterministiktir', () => {
        const args = ['https://github.com/acme/demo', 'dev/x', 'a b/c.ts'] as const;
        expect(buildFileLink(...args, { line: 3 })).toBe(buildFileLink(...args, { line: 3 }));
    });
});

describe('validateMermaidSource', () => {
    it('sağlıklı küçük akış şemasını kabul eder (http localhost click dahil)', () => {
        const source = [
            'flowchart TD',
            'parser["Parser"]',
            'server["Server"]',
            'parser --> server',
            'parser -- "çağrı" --> server',
            'click parser "https://github.com/acme/demo/blob/main/kokpit/parser/schema.ts"',
            'click server "http://localhost:4173/kokpit/server.ts"',
        ].join('\n');
        expect(validateMermaidSource(source)).toEqual({ ok: true });
    });

    it('başlıksız kaynak reddedilir', () => {
        expect(validateMermaidSource('A-->B')).toEqual({
            ok: false,
            reason: 'missing_flowchart_header',
        });
        expect(validateMermaidSource('pie\n"A": 1')).toEqual({
            ok: false,
            reason: 'missing_flowchart_header',
        });
    });

    it('null byte reddedilir', () => {
        expect(validateMermaidSource('flowchart TD\nA\u0000-->B')).toEqual({
            ok: false,
            reason: 'null_byte',
        });
    });

    it('CR içeren kaynak reddedilir', () => {
        expect(validateMermaidSource('flowchart TD\r\nA-->B')).toEqual({
            ok: false,
            reason: 'carriage_return',
        });
    });

    it('boş kaynak reddedilir', () => {
        expect(validateMermaidSource('')).toEqual({ ok: false, reason: 'empty_source' });
        expect(validateMermaidSource('  \n \n')).toEqual({
            ok: false,
            reason: 'empty_source',
        });
    });

    it('güvensiz click yönergesi reddedilir (js:, call, eksik biçim)', () => {
        const bads = [
            'flowchart TD\nA-->B\nclick A "javascript:alert(1)"',
            'flowchart TD\nA-->B\nclick A call alert()',
            'flowchart TD\nA-->B\nclick A',
            'flowchart TD\nA-->B\nclick A-B "https://github.com/x/y/blob/main/a.ts"',
        ];
        for (const bad of bads) {
            expect(validateMermaidSource(bad)).toEqual({
                ok: false,
                reason: 'unsafe_click_directive',
            });
        }
    });

    it('yalnız beyaz-listeli ve dengeli subgraph biçimini kabul eder', () => {
        const safe = [
            'flowchart TD',
            'subgraph group_analysis["Analysis Engine"]',
            'direction TB',
            'node_parser["Parser"]',
            'end',
        ].join('\n');
        expect(validateMermaidSource(safe)).toEqual({ ok: true });

        const bads = [
            'flowchart TD\nA["x"]\nclassDef evil fill:#f00',
            'flowchart TD\nsubgraph Z\nA["x"]\nend',
            'flowchart TD\nsubgraph group_safe["Safe"]\nsubgraph group_nested["Nested"]\nend\nend',
            'flowchart TD\nsubgraph group_safe["Safe"]\ndirection TB\ndirection LR\nend',
            'flowchart TD\nsubgraph group_safe["Safe"]\nA["x"]',
            'flowchart TD\n%%{init: {"securityLevel":"loose"}}%%',
            'flowchart TD\nstyle A fill:red',
            'flowchart TD\nflowchart LR',
            'flowchart TD\n%% gizli not',
        ];
        for (const bad of bads) {
            expect(validateMermaidSource(bad).ok).toBe(false);
        }
    });

    it('dengesiz tırnak ve parantez reddedilir', () => {
        expect(validateMermaidSource('flowchart TD\nA["oops]')).toEqual({
            ok: false,
            reason: 'unbalanced_quote',
        });
        expect(validateMermaidSource('flowchart TD\nA[x --> B')).toEqual({
            ok: false,
            reason: 'unbalanced_bracket',
        });
        expect(validateMermaidSource('flowchart TD\nA["x")) --> B')).toEqual({
            ok: false,
            reason: 'unbalanced_bracket',
        });
    });

    it('satır içi ayraç ve yorum kaçışı reddedilir', () => {
        expect(
            validateMermaidSource('flowchart TD\nA["y"]; click A javascript:alert(1)'),
        ).toEqual({ ok: false, reason: 'statement_separator' });
        expect(validateMermaidSource('flowchart TD\nA--> B %% dipnot')).toEqual({
            ok: false,
            reason: 'inline_comment',
        });
    });
});

describe('bütünleşik nöbetçi — escape + validate birlikte', () => {
    it('hostile etiketlerden derlenen kaynak kabul edilir ve yönergesiz kalır', () => {
        const hostileLabels = [
            'Parser (çekirdek)',
            '<script>alert(1)</script>',
            'x"; click A javascript:alert(1)',
            'x\nclassDef evil fill:#f00',
            'a\r\nb\u202Ekötü',
            'He said "hi" (x[y]{z})',
        ];

        const source = composeSource(hostileLabels);
        expect(validateMermaidSource(source)).toEqual({ ok: true });

        const forbiddenStart = /^(?:click|classDef|class|style|subgraph|end|init|%%)/;
        for (const line of source.split('\n')) {
            const trimmed = line.trim();
            if (
                trimmed.startsWith('flowchart') ||
                trimmed.startsWith('click ') ||
                trimmed.length === 0
            ) {
                continue;
            }
            expect(forbiddenStart.test(trimmed)).toBe(false);
        }
        // Etiketler tırnak içinde sıkışıktır: satırda tırnak sayısı çifttir.
        for (const line of source.split('\n')) {
            const quotes = line.split('"').length - 1;
            expect(quotes % 2).toBe(0);
        }
    });
});
