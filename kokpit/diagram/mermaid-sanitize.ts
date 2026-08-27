// Mermaid temizleme/doğrulama katmanı — Dilim 2.0, adım 3.
//
// Statik Mermaid ihracının (DESIGN D3) tek güvenlik sahibi: ham kimlik /
// etiket / bağlantı değerlerini deterministik ve enjeksiyona kapalı biçime
// indirir, üretilmiş kaynağı yapısal olarak denetler. Referanslar:
// gitdiagram `server/generate/mermaid-validator.ts` (satır denetimi fikri,
// burada saf-string olarak yeniden yazıldı; JSDOM/mermaid çalışma zamanı YOK)
// ve `features/diagram/mermaid-security.ts` (click beyaz listesi fikri).
//
// Saflık sözleşmesi: I/O yok, global durum yok, model çağrısı yok, zod'a
// bağımlılık yok. Aynı girdi her koşumda aynı çıktıyı verir.

/** Etiket uzunluk sınırı — `MAX_GRAPH_LABEL_LENGTH` ile aynı değer (72). */
export const MAX_LABEL_LENGTH = 72;

/** Doğrulama sonucu — makine sözleşmesi (DESIGN D1): nedenler İngilizce. */
export interface MermaidSourceValidation {
    ok: boolean;
    reason?: string;
}

const MERMAID_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Biçimlendirme (Cf), kontrol (Cc) ve satır ayırıcı (Zl/Zp) karakterler. */
const INVISIBLE_CHAR_PATTERN = /[\p{Cf}\p{Cc}\u2028\u2029]/gu;

/**
 * Kaçış sırası kritiktir: önce ham `;`, ardından `&` etkisizleştirilir ki
 * modülün daha sonra eklediği `#...;` varlık kodları ikinci turda bozulmasın. Hedef küme
 * Mermaid'in anlam yüklediği her karakterdir: tırnak, köşeli/normal parantez,
 * süslü parantez, açı parantezi (HTML), ayraç `;`, kenar ayracı `|`, yorum `%`.
 */
const LABEL_ESCAPE_STEPS: ReadonlyArray<readonly [RegExp, string]> = [
    [/;/g, '#59;'],
    [/&/g, '#38;'],
    [/"/g, '#quot;'],
    [/</g, '#60;'],
    [/>/g, '#62;'],
    [/\(/g, '#40;'],
    [/\)/g, '#41;'],
    [/\[/g, '#91;'],
    [/\]/g, '#93;'],
    [/\{/g, '#123;'],
    [/\}/g, '#125;'],
    [/\|/g, '#124;'],
    [/%/g, '#37;'],
];

const FLOWCHART_HEADER_PATTERN = /^flowchart[ \t]+(?:TB|TD|BT|RL|LR)$/;

/**
 * Kabul edilen tek `click` biçimi: bilinen düğüm kimliği + çift tırnak içinde
 * yalnızca http(s) adresi. `call ...` ve şemasız adresler reddedilir.
 */
const SAFE_CLICK_PATTERN =
    /^click[ \t]+[a-z][a-z0-9_]*[ \t]+"https?:\/\/[^"\s]+"$/;

/** Derleyicinin üretebildiği tek alt-graf biçimi: güvenli kimlik + kaçmış etiket. */
const SAFE_SUBGRAPH_PATTERN =
    /^subgraph[ \t]+group_[a-z][a-z0-9_]*\["[^"\r\n]*"\]$/;
const SAFE_DIRECTION_PATTERN = /^direction[ \t]+(?:TB|TD|BT|RL|LR)$/;

/**
 * Derleyicinin hiçbir koşumda üretlemediği üst-seviye yönergeler: config
 * blokları, stil/sınıf tanımı, ikinci başlık ve yorum. `subgraph`, `direction`
 * ve `end` yalnız aşağıdaki dengeli beyaz-listeli durum makinesiyle kabul edilir.
 */
const FORBIDDEN_STATEMENT_PATTERN =
    /^(?:%%|(?:classDef|class|style|linkStyle|init|graph|flowchart|accTitle|accDescr|config)\b)/;

const BRACKET_CLOSER_TO_OPENER: ReadonlyMap<string, string> = new Map([
    [')', '('],
    [']', '['],
    ['}', '{'],
]);

/** Boş/görünmez etiket için görünür yedek — davranış testle sabitlidir. */
const EMPTY_LABEL_FALLBACK = '—';

function fnv1a32(input: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/** Ham metni `[a-z0-9_]` kümesine indiren, anlamını koruyan ASCII slug. */
function asciiSlug(raw: string): string {
    const slug = raw
        .normalize('NFC')
        // NFD'nin çözmediği noktasız ı açıkça eşlenir; İ NFD ile I+nokta
        // ayrıştırıldığı için zaten doğru sonuca düşer.
        .replace(/ı/g, 'i')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (slug.length === 0) {
        return '';
    }
    return /^[0-9]/.test(slug) ? `n_${slug}` : slug;
}

/**
 * Ham değerden Mermaid-güvenli düğüm/grup kimliği: Türkçe dahil Unicode'u
 * anlamlı bir sluga indirir, çarpışma nöbetçisi olarak kısa içerik-hash'i
 * (FNV-1a, base36) sonek olarak ekler. Aynı girdi her koşumda aynı kimliği
 * verir; farklı girdiler aynı sluga düşse bile hash sonekiyle ayrışır.
 */
export function safeMermaidId(raw: string): string {
    const slug = asciiSlug(raw);
    const stem = slug.length > 0 ? slug : 'node';
    const id = `${stem}_${fnv1a32(raw).toString(36)}`;
    // Değişmez nöbetçisi: çıktının Mermaid kimliği deseni taşıması garanti.
    if (!MERMAID_ID_PATTERN.test(id)) {
        throw new TypeError(`safeMermaidId produced invalid id: "${id}".`);
    }
    return id;
}

/**
 * Etiketi tek satırlık, Mermaid için zararsız metne indirger: satır sonları
 * ve kontrol/biçim karakterleri (U+202E dahil) boşluğa iner, tırnak ve
 * parantez ailesi ile HTML benzeri içerik Mermaid varlık kodlarına kaçar,
 * backtick (markdown-string kapısı) düz kesmeye döner. Çıktı en fazla
 * MAX_LABEL_LENGTH uzundur; kırpma yarım kalan varlık kodunu onarır.
 * Görünmesi mümkün olmayan girdi görünür yedeğe iner.
 */
export function escapeMermaidLabel(raw: string): string {
    let value = raw.normalize('NFC');
    value = value.replace(INVISIBLE_CHAR_PATTERN, ' ');
    value = value.replace(/`/g, "'");
    for (const [pattern, replacement] of LABEL_ESCAPE_STEPS) {
        value = value.replace(pattern, replacement);
    }
    value = value.replace(/ {2,}/g, ' ').trim();
    value = truncateLabel(value);
    return value.length > 0 ? value : EMPTY_LABEL_FALLBACK;
}

/** Kod noktası güvenli kırpma + yarım kalan `#...` sonekinin onarımı. */
function truncateLabel(value: string): string {
    const chars = Array.from(value);
    if (chars.length <= MAX_LABEL_LENGTH) {
        return value;
    }
    return chars
        .slice(0, MAX_LABEL_LENGTH)
        .join('')
        .replace(/#[^; ]*$/, '')
        .replace(/ +$/, '');
}

type StructuralLineIssue =
    | 'unbalanced_quote'
    | 'unbalanced_bracket'
    | 'statement_separator'
    | 'inline_comment';

/**
 * Tek satırın yapısını tarar: tırnak dışında `;` (satır içi çok deyim kaçı),
 * `%%` (satır içi yorum), dengesiz parantez ve sondaki açık tırnak.
 */
function structuralLineIssue(line: string): StructuralLineIssue | null {
    const openBrackets: string[] = [];
    let insideQuote = false;
    for (let index = 0; index < line.length; index += 1) {
        const ch = line.charAt(index);
        if (insideQuote) {
            if (ch === '"') {
                insideQuote = false;
            }
            continue;
        }
        if (ch === '"') {
            insideQuote = true;
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') {
            openBrackets.push(ch);
            continue;
        }
        const opener = BRACKET_CLOSER_TO_OPENER.get(ch);
        if (opener !== undefined) {
            if (openBrackets.pop() !== opener) {
                return 'unbalanced_bracket';
            }
            continue;
        }
        if (ch === ';') {
            return 'statement_separator';
        }
        if (ch === '%' && line.charAt(index + 1) === '%') {
            return 'inline_comment';
        }
    }
    if (insideQuote) {
        return 'unbalanced_quote';
    }
    if (openBrackets.length > 0) {
        return 'unbalanced_bracket';
    }
    return null;
}

/**
 * Üretilmiş Mermaid kaynağının yapısal güvenlik denetimi. Etiketlerin hepsi
 * escapeMermaidLabel'dan geçtiği varsayılır; bu katman, tahrif edilmiş ya
 * da el yazımı kaynakta satır enjeksiyonunu (click/classDef/config),
 * null byte, CR, dengesiz tırnak/parantez ve satır içi ayraç kaçışlarını
 * reddeder. Alt-graf yalnız derleyicinin dar ve dengeli sözdiziminde kabul
 * edilir. Saftır: hiçbir şey çalıştırmaz, yalnızca okur.
 */
export function validateMermaidSource(source: string): MermaidSourceValidation {
    if (source.includes('\u0000')) {
        return { ok: false, reason: 'null_byte' };
    }
    if (source.includes('\r')) {
        return { ok: false, reason: 'carriage_return' };
    }

    const lines = source.split('\n');
    let headerIndex = -1;
    for (const [index, line] of lines.entries()) {
        if (line.trim().length > 0) {
            headerIndex = index;
            break;
        }
    }
    if (headerIndex < 0) {
        return { ok: false, reason: 'empty_source' };
    }

    const headerLine = lines[headerIndex];
    if (
        headerLine === undefined ||
        !FLOWCHART_HEADER_PATTERN.test(headerLine.trim())
    ) {
        return { ok: false, reason: 'missing_flowchart_header' };
    }

    let subgraphOpen = false;
    let directionSeen = false;
    for (const [index, rawLine] of lines.entries()) {
        const line = rawLine.trim();
        if (line.length === 0 || index === headerIndex) {
            continue;
        }

        if (line.startsWith('click')) {
            if (!SAFE_CLICK_PATTERN.test(line)) {
                return { ok: false, reason: 'unsafe_click_directive' };
            }
            continue;
        }
        if (line.startsWith('subgraph')) {
            if (subgraphOpen || !SAFE_SUBGRAPH_PATTERN.test(line)) {
                return { ok: false, reason: 'forbidden_directive' };
            }
            const structural = structuralLineIssue(line);
            if (structural !== null) return { ok: false, reason: structural };
            subgraphOpen = true;
            directionSeen = false;
            continue;
        }
        if (line.startsWith('direction')) {
            if (!subgraphOpen || directionSeen || !SAFE_DIRECTION_PATTERN.test(line)) {
                return { ok: false, reason: 'forbidden_directive' };
            }
            directionSeen = true;
            continue;
        }
        if (line.startsWith('end')) {
            if (!subgraphOpen || line !== 'end') {
                return { ok: false, reason: 'forbidden_directive' };
            }
            subgraphOpen = false;
            directionSeen = false;
            continue;
        }
        if (FORBIDDEN_STATEMENT_PATTERN.test(line)) {
            return { ok: false, reason: 'forbidden_directive' };
        }

        const structural = structuralLineIssue(line);
        if (structural !== null) {
            return { ok: false, reason: structural };
        }
    }

    if (subgraphOpen) return { ok: false, reason: 'unclosed_subgraph' };

    return { ok: true };
}

/**
 * Kaynak dosyaya giden dosya bağlantısı: yol segmentleri tek tek
 * kodlanır, dal adındaki `/` korunur, `..` gezinimi ve http(s) dışı
 * temel adresler reddedilir. `opts.line` GitHub `#L<satır>` hedefi ekler.
 */
export function buildFileLink(
    baseUrl: string,
    branch: string,
    path: string,
    opts?: { line?: number },
): string {
    let url: URL;
    try {
        url = new URL(baseUrl);
    } catch {
        throw new TypeError(`Invalid base URL: "${baseUrl}".`);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new TypeError(
            `Unsupported base URL protocol: "${url.protocol}".`,
        );
    }

    if (opts?.line !== undefined && (!Number.isInteger(opts.line) || opts.line < 1)) {
        throw new RangeError(`Invalid line number: ${opts.line}.`);
    }

    const branchSegments = splitPathSegments(branch);
    if (branchSegments.length === 0) {
        throw new RangeError(`Invalid branch: "${branch}".`);
    }
    const pathSegments = splitPathSegments(path);
    if (pathSegments.length === 0) {
        throw new RangeError(`Invalid path: "${path}".`);
    }

    const basePath = url.pathname.replace(/\/+$/, '');
    const encodedBranch = branchSegments.map(encodeURIComponent).join('/');
    const encodedPath = pathSegments.map(encodeURIComponent).join('/');
    let link = `${url.origin}${basePath}/blob/${encodedBranch}/${encodedPath}`;
    if (opts?.line !== undefined) {
        link += `#L${opts.line}`;
    }
    return link;
}

/** Yolu segmentlere böler; boş ve `.` segmentleri atar, `..`yi reddeder. */
function splitPathSegments(value: string): string[] {
    const segments = value
        .split('/')
        .filter((segment) => segment.length > 0 && segment !== '.');
    if (segments.some((segment) => segment === '..')) {
        throw new RangeError(`Path traversal is not allowed: "${value}".`);
    }
    return segments;
}
