// Dilim 1 · Faz dosyası durum-sinyali ayrıştırıcı.
//
// Girdi: .agents/phases/*.md tarzı defter dosyaları. Başlık satırlarındaki
// bilinen durum sözcüklerinden sinyal üretir; gövde yorumlamaz (v0 sınırı —
// "D4-F canlı kusur" gibi durumsuz başlıklar sessizce atlanır, uydurulmaz).
//
// Öncelik sırası şemadaki StatusToken ile aynı; ilk eşleşen kazanır.

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { FileSignal, PhaseFileScan, StatusToken } from './schema';
import { PhaseFileScan as PhaseFileScanSchema } from './schema';

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const DATE_RE = /(\d{4}-\d{2}-\d{2})/;

/** Sıra anlamlıdır: önce özel/spesifik token, sonra genel.
 *  NOT: PLAN bilinçli olarak kaldırıldı (K3) — gerçek defterlerde yanlış-pozitif
 *  üretimi yüksekti ("plan değildir", "(plan metni, tarihsel)"). Gerekirse ileride
 *  emoji/tarih şartıyla geri gelir. */
const TOKEN_RULES: ReadonlyArray<readonly [StatusToken, RegExp]> = [
    ['DOCS_LOCK', /DOCS[\s-]*LOCK/i],
    ['WAITING_HUMAN', /WAITING[_ ]FOR|BEKL[İI]YOR/i],
    ['UYGULANDI', /UYGULANDI/i],
    ['KAPANDI', /\bKAPANDI\b/i],
    ['KAPALI', /\bKAPAL[Iİ]\b/i],
    ['LOCKED', /LOCKED/i],
    ['ACIK', /\bAÇIK\b/],
    ['DUZELTME', /DÜZELTME/i],
    ['GO', /\bGO\b/],
    ['RUNTIME', /RUNTIME/i],
];

/** K3: yapısal başlıklar durum taşımaz — her zaman atlanır. */
const STRUCTURAL_SKIP: ReadonlyArray<RegExp> = [/^runtime açma (kapısı|koşulları)/i];
/** K3: olumsuzlama koruması — "…değildir" kalıbı sinyal üretemez. */
const NEGATION_RE = /değildir/i;

function detectToken(headingText: string): StatusToken | null {
    if (STRUCTURAL_SKIP.some((re) => re.test(headingText))) return null;
    if (NEGATION_RE.test(headingText)) return null;

    const hasDate = DATE_RE.test(headingText);
    const hasStamp = /✅|🔧/.test(headingText);

    for (const [token, re] of TOKEN_RULES) {
        if (!re.test(headingText)) continue;
        // DUZELTME konu-başlığıyla karışır ("Güvenlik Düzeltmeleri"): kanıt şartı.
        if (token === 'DUZELTME' && !hasDate && !hasStamp) continue;
        return token;
    }
    return null;
}

/** Saf çekirdek. */
export function scanPhaseFileText(text: string, sourceFile = 'inline'): PhaseFileScan {
    const lines = text.split(/\r?\n/);
    const signals: FileSignal[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const m = HEADING_RE.exec(line);
        if (!m) continue;
        const heading = (m[2] ?? '').trim();
        const token = detectToken(heading);
        if (!token) continue;
        const date = DATE_RE.exec(heading)?.[1];
        signals.push({ file: sourceFile, heading, token, date, line: i + 1 });
    }

    const scan: PhaseFileScan = { schemaVersion: 1, sourceFile, signals };
    return PhaseFileScanSchema.parse(scan);
}

/** Dizindeki tüm .md dosyalarını sırayla tarar (non-recursive — phases dizisi düzdür). */
export function scanPhaseDirectory(dirPath: string): PhaseFileScan[] {
    const results: PhaseFileScan[] = [];
    for (const entry of readdirSync(dirPath).sort()) {
        if (!entry.endsWith('.md')) continue;
        const full = join(dirPath, entry);
        results.push(scanPhaseFileText(readFileSync(full, 'utf8'), entry));
    }
    return results;
}
