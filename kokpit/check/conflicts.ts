// Dilim 5 · Karar bütünlüğü (UI-SPEC §10.5).
//
// v2 sertleştirmesi: gerçek korpuslarda jenerik tokenların (2026, açık, adı,
// backend…) aday doldurması kapatıldı. Artık (1) saf sayı/yıl ve genel
// sözcükler tokenize aşamasında elenir; (2) kısıt/genişletme yönü konu
// terimleriyle AYNI CÜMLEDE ölçülür; (3) plan cümlesi ile liderin KARAR
// metni arasında en az 2 ayırt edici ortak token (ya da 1 token + başlıkta
// aynı token) aranır — farklı karar akışları eşleşemez; (4) lider-içi
// düzeltme akışı (eski kısıt KARAR → yeni genişletici KARAR) aynı sıkı
// kurallarla izlenir. Modül saftır: I/O yok, girdi metinler ctx ile gelir.

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

/**
 * Genel sözcük kümesi: konu ayırt ediciliği taşımayan idari/bağlam sözcükleri.
 * Bu kümedeki tokenlar konu kanıtı olarak asla kullanılmaz.
 */
const STOPWORDS = new Set([
    // bağlaç / edat / yardımcı
    'için', 'olarak', 'kadar', 'ancak', 'daha', 'sonra', 'önce', 'göre', 'veya',
    'ile', 'ama', 've', 'gibi', 'her', 'tüm', 'bazı', 'değil', 'yani', 'yine',
    'tekrar', 'ayrıca', 'çünkü', 'eğer', 'nasıl', 'neden', 'böyle', 'şöyle',
    'sadece', 'yalnız', 'zaten', 'henüz', 'birlikte', 'diğer', 'karşı',
    // işaret / nicelik
    'bu', 'şu', 'o', 'bir', 'iki', 'üç', 'biri', 'hepsi',
    // sayı sıfatı / zarf / genel ad (entegrasyon ölçümü: zayıf çapa eleme)
    'ikinci', 'üçüncü', 'dördüncü', 'kaldı', 'kalıcı', 'geçici', 'başına',
    'yerine', 'kendi', 'kapı', 'satır', 'satırı', 'değer', 'özet',
    // genel idari/kavram sözcükleri (Dilim 5.2 sertleştirmesi)
    'açık', 'adı', 'backend', 'frontend', 'ayrı', 'eski', 'yeni', 'kapsam',
    'plan', 'planı', 'sistem', 'sistemi', 'kullanıcı', 'karar', 'kararı',
    'tarih', 'tarihli', 'yıl', 'gün', 'form', 'filtre', 'arama', 'erişim',
    'kalem', 'geçerli', 'kapanış', 'kapalı', 'durum', 'sahibi', 'protokol',
    'kural', 'seçenek', 'tavsiye', 'bedel', 'notu', 'hâlâ', 'bugün',
    'bugünkü', 'yoktur', 'varsa', 'yoksa', 'olan', 'olur', 'oldu', 'olduğu',
    'olmalı', 'olmalıdır', 'yapılır', 'edilir', 'gerekli', 'amaç', 'hedef',
    'öncelik', 'süreç', 'işlem', 'bölüm', 'rapor', 'sayfa', 'ekran', 'dilim',
    'faz', 'madde', 'proje', 'güncelleme', 'son', 'ilk', 'genel', 'temel',
    'closed', 'open', 'default', 'scope', 'topic', 'roadmap', 'milestone',
    'task', 'todo', 'done', 'list', 'file', 'line', 'name', 'date', 'user',
    // tokenleştirici asla üretemez; kuralların açık kalması için taşınır
    'kapsam-dışı', 'karar-defteri',
]);

const TOKEN_RE = /[a-zçğıöşü0-9]{3,}/g;
const PURE_NUMBER_RE = /^\d+$/;
/** Ayırt edici önek eşiği: kısa taraf en az bu kadar karakter olmalı. */
const MIN_DISTINCTIVE_LENGTH = 5;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** İşaretleyici eşleşmesi: işaret sözcük başında olmalı ("açılır"✓, "araç"✗). */
function matchesMarker(sentence: string, marker: string): boolean {
    return new RegExp(`\\b${escapeRegExp(marker)}`).test(sentence);
}

/** Cümle bölücü: nokta, ünlem, soru, noktalı virgül ve iki nokta. */
function splitSentences(paragraph: string): string[] {
    return paragraph
        .split(/(?<=[.!?;:])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
}

/**
 * Ham token kümesi: filtre uygulanmaz; yalnız "yalnız jenerik ortak token"
 * reddini dürüst sınıflandırmak için kullanılır.
 */
function tokenizeRaw(text: string): Set<string> {
    return new Set(text.toLocaleLowerCase('tr-TR').match(TOKEN_RE) ?? []);
}

function isQualifiedToken(token: string): boolean {
    if (PURE_NUMBER_RE.test(token)) return false;
    if (STOPWORDS.has(token)) return false;
    if (NEGATION_MARKERS.includes(token)) return false;
    return true;
}

/** Konu adayı tokenlar: sayı/yıl ve genel sözcükler elenmiş küme. */
function tokenize(text: string): Set<string> {
    const tokens = new Set<string>();
    for (const token of text.toLocaleLowerCase('tr-TR').match(TOKEN_RE) ?? []) {
        if (!isQualifiedToken(token)) continue;
        tokens.add(token);
    }
    return tokens;
}

/**
 * Türkçe sonek varyantları (korpus/korpusu) tek karakter farklıdır; eşikli
 * önek eşleşmesi bu aileyi yakalar. Kısa taraf EN AZ 5 karakter olmalı ve
 * genel sözcük kümesinde OLMAMALIDIR — aksi hâlde "2026/2026", "tez/tezi"
 * gibi çöp veya zayıf çiftler konu kanıtı sayılır. Aynı kökün sonek
 * ailesi (testler/testleri) TEK hit sayılır: aile içi üye çift öneki
 * başka bir hite yer ise yalnız en uzun üye korunur — tek sözcük ailesi
 * "2 ayrı ortak token" izlenimi uyduramaz.
 */
function tokensIntersect(a: Set<string>, b: Set<string>): string[] {
    const hits = new Set<string>();
    for (const left of a) {
        for (const right of b) {
            const shorter = left.length <= right.length ? left : right;
            const longer = shorter === left ? right : left;
            if (shorter.length < MIN_DISTINCTIVE_LENGTH) continue;
            if (STOPWORDS.has(shorter)) continue;
            if (longer.startsWith(shorter)) hits.add(shorter);
        }
    }
    const sorted = [...hits].sort();
    return sorted.filter((hit, index) => {
        const next = sorted[index + 1];
        return !(next && next.startsWith(hit));
    });
}

/** Eski gevşek kural (≥3 önek, genel sözcük dahil) — yalnız red sınıflaması için. */
function looseIntersect(a: Set<string>, b: Set<string>): string[] {
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
    rawTokens: Set<string>;
    observedAt: string;
}

/**
 * Planın KISITLAYICI cümleleri: negasyon işaretleyicisi konu terimleriyle
 * aynı cümlede olan tekil cümleler. Paragraf tamponu değil, cümle ölçüsü
 * ölçülür — yön kanıtı cümle sınırlıdır.
 */
function planRestrictiveStatements(planText: string, fallbackDate: string): PlanStatement[] {
    const statements: PlanStatement[] = [];
    const lines = planText.split(/\r?\n/);
    let buffer = '';
    let bufferLine = 0;
    const flush = (): void => {
        if (!buffer) return;
        const paragraph = buffer.trim();
        buffer = '';
        const paragraphDate = /\d{4}-\d{2}-\d{2}/.exec(paragraph)?.[0] ?? planDate(planText, fallbackDate);
        for (const sentence of splitSentences(paragraph)) {
            const lowered = sentence.toLocaleLowerCase('tr-TR');
            if (!NEGATION_MARKERS.some((marker) => matchesMarker(lowered, marker))) continue;
            statements.push({
                line: bufferLine,
                text: sentence,
                tokens: tokenize(sentence),
                rawTokens: tokenizeRaw(sentence),
                observedAt: paragraphDate,
            });
        }
    };
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? '';
        // Markdown başlığı cümle sınırıdır: tamponu boşaltır, kendisi cümle olamaz.
        if (/^#{1,6}\s/.test(line)) {
            flush();
            continue;
        }
        if (!line.trim()) {
            flush();
            continue;
        }
        if (!buffer) bufferLine = index + 1;
        buffer += ` ${line}`;
        if (/[.;:]\s*$/.test(line) || index === lines.length - 1) flush();
    }
    flush();
    return statements;
}

interface DecisionSentence {
    tokens: Set<string>;
    hasExpansion: boolean;
    hasNegation: boolean;
}

interface LedgerSection {
    heading: string;
    line: number;
    date: string;
    isDecision: boolean;
    body: string;
    tokens: Set<string>;
    rawTokens: Set<string>;
    headingTokens: Set<string>;
    decisionText: string;
    decisionTokens: Set<string>;
    decisionRawTokens: Set<string>;
    decisionSentences: DecisionSentence[];
}

function decisionSentencesOf(decisionText: string): DecisionSentence[] {
    return splitSentences(decisionText).map((sentence) => {
        const lowered = sentence.toLocaleLowerCase('tr-TR');
        return {
            tokens: tokenize(sentence),
            hasExpansion: EXPANSION_MARKERS.some((marker) => matchesMarker(lowered, marker)),
            hasNegation: NEGATION_MARKERS.some((marker) => matchesMarker(lowered, marker)),
        };
    });
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
            rawTokens: tokenizeRaw(authorityText),
            headingTokens: tokenize(current.heading),
            decisionText,
            decisionTokens: tokenize(decisionText),
            decisionRawTokens: tokenizeRaw(decisionText),
            decisionSentences: decisionSentencesOf(decisionText),
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

/** Sertleştirilmiş çelişki reddi nedenleri — sabit sıra, deterministik rapor. */
export type ConflictRejectionReason =
    | 'generic-token-only'
    | 'no-restrictive-direction'
    | 'no-expansive-direction'
    | 'weak-topic-overlap'
    | 'unrelated-flow'
    | 'repeated-restriction'
    | 'chronology-invalid';

export const CONFLICT_REJECTION_REASONS: ConflictRejectionReason[] = [
    'generic-token-only',
    'no-restrictive-direction',
    'no-expansive-direction',
    'weak-topic-overlap',
    'unrelated-flow',
    'repeated-restriction',
    'chronology-invalid',
];

export interface ConflictEvaluation {
    entries: ConflictEntry[];
    rawCandidateCount: number;
    rejectionCounts: Record<ConflictRejectionReason, number>;
    truncationReasons: string[];
    scannedScope: {
        planStatements: number;
        ledgerSections: number;
        ledgerDecisions: number;
        pairsEvaluated: number;
    };
}

const MAX_CONFLICT_ENTRIES = 64;

/** Ayırt edici konu: karar metniyle ≥2 ortak token, ya da 1 token + başlıkta aynı token. */
function establishFlow(
    sideATokens: Set<string>,
    sideARawTokens: Set<string>,
    section: LedgerSection,
): { status: 'ok' | ConflictRejectionReason; topic: string[] } {
    const sectionTopic = tokensIntersect(sideATokens, section.tokens);
    if (sectionTopic.length === 0) {
        const loose = looseIntersect(sideARawTokens, section.rawTokens);
        return { status: loose.length ? 'generic-token-only' : 'weak-topic-overlap', topic: [] };
    }
    const decisionTopic = tokensIntersect(sideATokens, section.decisionTokens);
    if (decisionTopic.length >= 2) return { status: 'ok', topic: decisionTopic.slice(0, 3) };
    if (
        decisionTopic.length === 1 &&
        tokensIntersect(new Set(decisionTopic), section.headingTokens).length >= 1
    ) {
        return { status: 'ok', topic: decisionTopic };
    }
    return { status: 'unrelated-flow', topic: sectionTopic };
}

function sentenceSharesTopic(topic: string[], sentence: DecisionSentence): boolean {
    return tokensIntersect(new Set(topic), sentence.tokens).length > 0;
}

/**
 * Çelişki değerlendiricisi: (1) plan kısıt cümlesi × lider KARAR bölümü ve
 * (2) lider-içi düzeltme akışı (aynı defterde eski kısıt KARAR → yeni
 * genişletici KARAR) aynı kapı dizisiyle ölçülür:
 *   konu kalitesi → karar-akışı şartı → kısıt yönü → genişletme yönü →
 *   tekrar-kısıt → kronoloji. Ham adaylar; çıktı sınırı ve id tekrarı
 * dışında hiçbir ayıklama yapılmadan sayılır (dürüst ölçüm).
 */
export function evaluateConflicts(ctx: ConflictContext): ConflictEvaluation {
    const rejectionCounts = Object.fromEntries(
        CONFLICT_REJECTION_REASONS.map((reason) => [reason, 0]),
    ) as Record<ConflictRejectionReason, number>;
    const scannedScope = { planStatements: 0, ledgerSections: 0, ledgerDecisions: 0, pairsEvaluated: 0 };
    if (!ctx.ledgerText) {
        return { entries: [], rawCandidateCount: 0, rejectionCounts, truncationReasons: [], scannedScope };
    }
    const sections = ledgerSections(ctx.ledgerText);
    const decisionSections = sections.filter((section) => section.isDecision);
    const statements = planRestrictiveStatements(ctx.planText, ctx.fallbackDate);
    scannedScope.planStatements = statements.length;
    scannedScope.ledgerSections = sections.length;
    scannedScope.ledgerDecisions = decisionSections.length;

    const seeds: ConflictEntry[] = [];
    const reject = (reason: ConflictRejectionReason): void => {
        rejectionCounts[reason] += 1;
    };
    const topicText = (topic: string[]): string => `${topic.join(', ')} (kısıt→genişletme)`;

    for (const statement of statements) {
        for (const section of decisionSections) {
            scannedScope.pairsEvaluated += 1;
            // Kısıt yönü yapısal olarak doğrudur: ifade tek cümledir ve
            // seçimi negasyonla yapılmıştır; konu terimleri aynı cümlededir.
            const flow = establishFlow(statement.tokens, statement.rawTokens, section);
            if (flow.status !== 'ok') {
                reject(flow.status);
                continue;
            }
            const expansionSentences = section.decisionSentences.filter(
                (sentence) => sentence.hasExpansion && sentenceSharesTopic(flow.topic, sentence),
            );
            if (!expansionSentences.length) {
                reject('no-expansive-direction');
                continue;
            }
            if (!expansionSentences.some((sentence) => !sentence.hasNegation)) {
                reject('repeated-restriction');
                continue;
            }
            if (section.date <= statement.observedAt) {
                reject('chronology-invalid');
                continue;
            }
            seeds.push({
                id: `conflict:${slugify(flow.topic.join('-')).slice(0, 48)}:${slugify(ctx.planPath).slice(0, 32)}:${slugify(ctx.ledgerPath).slice(0, 32)}`,
                topic: topicText(flow.topic),
                status: 'candidate',
                authorityA: `${ctx.planPath} · L${statement.line} — "…${statement.text.slice(0, 90)}…"`,
                authorityB: `${ctx.ledgerPath} · L${section.line} — ${section.heading.slice(0, 90)} (${section.date})`,
                observedAtA: statement.observedAt,
                observedAtB: section.date,
                suggestion:
                    'Add a superseded-note to the older authority line, or record this as an accepted conflict in the decision ledger (human confirmation required).',
            });
        }
    }

    // Lider-içi düzeltme akışı: aynı defter içinde eski kısıtlayıcı KARAR
    // cümlesi → yeni genişletici KARAR cümlesi (ör. DÜZELTİLMİŞ KART).
    for (const restrictive of decisionSections) {
        for (const expansive of decisionSections) {
            if (restrictive === expansive) continue;
            scannedScope.pairsEvaluated += 1;
            const flow = establishFlow(restrictive.tokens, restrictive.rawTokens, expansive);
            if (flow.status !== 'ok') {
                reject(flow.status);
                continue;
            }
            const restrictionSentences = restrictive.decisionSentences.filter(
                (sentence) => sentence.hasNegation && sentenceSharesTopic(flow.topic, sentence),
            );
            if (!restrictionSentences.length) {
                reject('no-restrictive-direction');
                continue;
            }
            const expansionSentences = expansive.decisionSentences.filter(
                (sentence) => sentence.hasExpansion && sentenceSharesTopic(flow.topic, sentence),
            );
            if (!expansionSentences.length) {
                reject('no-expansive-direction');
                continue;
            }
            if (!expansionSentences.some((sentence) => !sentence.hasNegation)) {
                reject('repeated-restriction');
                continue;
            }
            if (restrictive.date >= expansive.date) {
                reject('chronology-invalid');
                continue;
            }
            seeds.push({
                id: `conflict:${slugify(flow.topic.join('-')).slice(0, 48)}:${slugify(ctx.ledgerPath).slice(0, 32)}:duzeltme`,
                topic: topicText(flow.topic),
                status: 'candidate',
                authorityA: `${ctx.ledgerPath} · L${restrictive.line} — ${restrictive.heading.slice(0, 90)} (${restrictive.date})`,
                authorityB: `${ctx.ledgerPath} · L${expansive.line} — ${expansive.heading.slice(0, 90)} (${expansive.date})`,
                observedAtA: restrictive.date,
                observedAtB: expansive.date,
                suggestion:
                    'Add a superseded-note to the older authority line, or record this as an accepted conflict in the decision ledger (human confirmation required).',
            });
        }
    }

    const rawCandidateCount = seeds.length;
    const truncationReasons: string[] = [];
    const seen = new Set<string>();
    const deduped = seeds.filter((entry) => {
        if (seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
    });
    if (deduped.length < seeds.length) truncationReasons.push('duplicate-candidate-id');
    const entries = deduped.slice(0, MAX_CONFLICT_ENTRIES);
    if (deduped.length > entries.length) truncationReasons.push('candidate-cap-64');
    return { entries: sortConflicts(entries), rawCandidateCount, rejectionCounts, truncationReasons, scannedScope };
}

/**
 * Çelişki adayı: plan cümlesi konuyu negasyonla sınırlandırırken karar
 * defterindeki sonraki tarihli KARAR aynı konuyu aynı cümlede genişletme
 * yönünde işliyorsa iki otorite farklı yön bildiriyordur. Jenerik tokenlar,
 * cümle-dışı yön sinyalleri ve ilgisiz karar akışları aday üretmez.
 */
export function detectConflicts(ctx: ConflictContext): ConflictEntry[] {
    return evaluateConflicts(ctx).entries;
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
