// Dilim 5 · Karar bütünlüğü (UI-SPEC §10.5).
//
// v1 yarım-otomatiktir ve bunu açıkça söyler: anahtar-kelime + tarih sırası
// sezgiseli ile aday çelişki üretir; insan onayı olmadan hiçbir kayıt
// "çözüldü" sayılmaz. Kararlar asla silinmez; superseded zinciri taşınır.
// Modül saftır: I/O yok, girdi metinler ctx ile gelir.

import type { ConflictEntry } from './schema';
import { slugify } from './rules';

export interface ConflictContext {
    planText: string;
    planPath: string;
    /** .agents/karar-defteri.md içeriği; dosya yoksa null — uydurma yapılmaz. */
    ledgerText: string | null;
    ledgerPath: string;
    /** Plan satırlarının tarih taşımaması hâlinde dürüst geri-düşüş. */
    fallbackDate: string;
}

const NEGATION_MARKERS = [
    'değildir',
    'eklenmez',
    'kurulmaz',
    'paylaşılmaz',
    'girmez',
    'kullanılmaz',
    'birleştirilmez',
    'gömülmez',
    'yapılmaz',
    'gelmez',
    'olmaz',
];

const EXPANSION_MARKERS = [
    'genişlet',
    'ekle',
    'aç',
    'adopt',
    'birleştir',
    'kullanıma al',
    'devreye al',
];

const STOPWORDS = new Set([
    'için', 'olarak', 'kadar', 'ancak', 'daha', 'sonra', 'göre', 'kararı', 'karar',
    'durum', 'sahibi', 'protokol', 'kural', 'seçenek', 'tavsiye', 'bedel', 'notu',
    'bu', 'şu', 'veya', 'ile', 'biri', 'hâlâ', 'bugün', 'bugünkü', 'yeni',
    'yoktur', 'varsa', 'yoksa', 'olan', 'olur', 'oldu', 'olduğu', 'olmalı',
]);

function tokenize(text: string): Set<string> {
    const tokens = new Set<string>();
    const matches = text.toLocaleLowerCase('tr-TR').match(/[a-zçğıöşü0-9]{3,}/g) ?? [];
    for (const token of matches) {
        if (STOPWORDS.has(token) || NEGATION_MARKERS.includes(token)) continue;
        tokens.add(token);
    }
    return tokens;
}

/**
 * Türkçe sonek varyantları (korpus/korpusu, tez/tezi) tek karakter farklıdır;
 * eşikli önek eşleşmesi bu aileyi yakalar. İki yönlü önek koşulu, kısa olan
 * tarafın en az 3 karakter olmasıyla korunur.
 */
function tokensIntersect(a: Set<string>, b: Set<string>): string[] {
    const hits = new Set<string>();
    for (const left of a) {
        for (const right of b) {
            const shorter = left.length <= right.length ? left : right;
            const longer = shorter === left ? right : left;
            if (longer.startsWith(shorter)) hits.add(shorter);
        }
    }
    return [...hits].sort();
}

function planDate(text: string, fallbackDate: string): string {
    const match = /son güncelleme\**\s*:\**\s*(\d{4}-\d{2}-\d{2})/i.exec(text);
    return match?.[1] ?? fallbackDate;
}

interface PlanStatement {
    line: number;
    text: string;
    tokens: Set<string>;
    observedAt: string;
}

function planNegationStatements(planText: string, limit: number, fallbackDate: string): PlanStatement[] {
    const statements: PlanStatement[] = [];
    const lines = planText.split(/\r?\n/);
    let buffer = '';
    let bufferLine = 0;
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? '';
        // Markdown başlığı cümle sınırıdır: tamponu boşaltır, kendisi cümle olamaz.
        if (/^#{1,6}\s/.test(line)) {
            buffer = '';
            continue;
        }
        if (!line.trim()) {
            buffer = '';
            continue;
        }
        if (!buffer) bufferLine = index + 1;
        buffer += ` ${line}`;
        const statementEnds = /[.;:]\s*$/.test(line) || index === lines.length - 1;
        if (!statementEnds) continue;
        if (NEGATION_MARKERS.some((marker) => buffer.includes(marker))) {
            const observedAt = /\d{4}-\d{2}-\d{2}/.exec(buffer)?.[0] ?? planDate(planText, fallbackDate);
            statements.push({ line: bufferLine, text: buffer.trim(), tokens: tokenize(buffer), observedAt });
            if (statements.length >= limit) return statements;
        }
        buffer = '';
    }
    return statements;
}

interface LedgerSection {
    heading: string;
    line: number;
    date: string;
    isDecision: boolean;
    body: string;
    tokens: Set<string>;
    decisionText: string;
}

function ledgerSections(text: string): LedgerSection[] {
    const sections: LedgerSection[] = [];
    const lines = text.split(/\r?\n/);
    let current: { heading: string; line: number; body: string[] } | null = null;
    const flush = (): void => {
        if (!current) return;
        const body = current.body.join('\n');
        const decisionIndex = current.body.findIndex((line) => /KARAR/i.test(line));
        const decisionLines: string[] = [];
        if (decisionIndex >= 0) {
            for (let index = decisionIndex; index < Math.min(current.body.length, decisionIndex + 3); index += 1) {
                const line = current.body[index] ?? '';
                if (index > decisionIndex && !line.trim()) break;
                decisionLines.push(line);
            }
        }
        const decisionText = decisionLines.join(' ').trim();
        const authorityText = `${current.heading}\n${decisionText}`;
        const date = /\d{4}-\d{2}-\d{2}/.exec(authorityText)?.[0];
        if (!date) {
            current = null;
            return;
        }
        sections.push({
            heading: current.heading,
            line: current.line,
            date,
            isDecision: /KARAR/i.test(authorityText),
            body: `${current.heading}\n${body}`,
            tokens: tokenize(authorityText),
            decisionText,
        });
        current = null;
    };
    for (let index = 0; index < lines.length; index += 1) {
        const heading = /^#{2,3}\s+(.*)$/.exec(lines[index] ?? '');
        if (heading) {
            flush();
            current = { heading: heading[1]?.trim() ?? '', line: index + 1, body: [] };
            continue;
        }
        current?.body.push(lines[index] ?? '');
    }
    flush();
    return sections;
}

/**
 * Çelişki adayı: plan cümlesi konuyu NEGASYONLA sınırlandırırken karar
 * defterindeki sonraki tarihli KARAR aynı konuyu genişletme yönünde
 * işliyorsa, iki otorite farklı yön bildiriyor demektir. Kesişim ≥2
 * anlamlı öbek zorunludur; tek kelime tesadüf üretir.
 */
export function detectConflicts(ctx: ConflictContext): ConflictEntry[] {
    const entries: ConflictEntry[] = [];
    if (!ctx.ledgerText) return entries;
    const sections = ledgerSections(ctx.ledgerText);
    const statements = planNegationStatements(ctx.planText, 64, ctx.fallbackDate);
    const seen = new Set<string>();
    for (const statement of statements) {
        for (const section of sections) {
            if (!section.isDecision) continue;
            if (section.date <= statement.observedAt) continue;
            const expands = EXPANSION_MARKERS.some((marker) => section.decisionText.toLocaleLowerCase('tr-TR').includes(marker));
            const repeatsRestriction = NEGATION_MARKERS.some((marker) => section.decisionText.toLocaleLowerCase('tr-TR').includes(marker));
            if (!expands || repeatsRestriction) continue;
            const intersection = tokensIntersect(statement.tokens, section.tokens).slice(0, 3);
            if (intersection.length < 2) continue;
            const conflictId = `conflict:${slugify(intersection.join('-'))}`;
            if (seen.has(conflictId)) continue;
            seen.add(conflictId);
            entries.push({
                id: conflictId,
                topic: intersection.join(', '),
                status: 'candidate',
                authorityA: `${ctx.planPath} · L${statement.line} — "…${statement.text.slice(0, 90)}…"`,
                authorityB: `${ctx.ledgerPath} · L${section.line} — ${section.heading.slice(0, 90)} (${section.date})`,
                observedAtA: statement.observedAt,
                observedAtB: section.date,
                suggestion:
                    'Add a superseded-note to the older authority line, or record this as an accepted conflict in the decision ledger (human confirmation required).',
            });
            if (entries.length >= 64) return sortConflicts(entries);
        }
    }
    return sortConflicts(entries);
}

/**
 * Superseded zinciri gözcüsü: "yürürlükten kaldırır/geçersiz kılar" bildiren
 * bölüm hedefinden ESKİ tarihliyse zincir kronolojisi bozulmuştır — karar
 * silinmez, bozuk zincir ayrı bir bütünlük kaydı olarak raporlanır.
 */
export function detectBrokenSupersededChains(ctx: ConflictContext): ConflictEntry[] {
    if (!ctx.ledgerText) return [];
    const sections = ledgerSections(ctx.ledgerText);
    const entries: ConflictEntry[] = [];
    for (const section of sections) {
        if (!/supersedes|yürürlükten kaldırır|geçersiz kılar/i.test(section.body)) continue;
        const targets = sections.filter((candidate) =>
            candidate !== section &&
            section.date < candidate.date &&
            tokensIntersect(section.tokens, candidate.tokens).length >= 2,
        );
        if (!targets.length) continue;
        entries.push({
            id: `conflict:superseded-chain-${slugify(section.heading).slice(0, 40)}`,
            topic: 'superseded-chain',
            status: 'superseded-chain',
            authorityA: `${ctx.ledgerPath} · L${section.line} — ${section.heading.slice(0, 90)} (${section.date})`,
            authorityB: `${ctx.ledgerPath} · L${targets[0]?.line ?? 0} — ${targets[0]?.heading.slice(0, 60) ?? ''} (${targets[0]?.date ?? ''})`,
            observedAtA: section.date,
            observedAtB: targets[0]?.date ?? section.date,
            suggestion: 'Fix the superseded-chain chronology: a superseding decision cannot predate the decision it retires.',
        });
    }
    return sortConflicts(entries);
}

function sortConflicts(entries: ConflictEntry[]): ConflictEntry[] {
    return [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
