// Dilim 1 · ROADMAP checkbox ayrıştırıcı.
//
// Girdi: MethodLogos tarzı yol haritası markdown'ı. Bilinen biçimler:
//   - [x] **#1 Konsensüs körlüğünü gider:** ... — **Tamamlandı 2026-07-17**;
//         devam satırı...
//   - [~] **Sorgu boru hattı:** ...
//   - [ ] Kartopu (snowballing): OpenAlex ile takip.        ← bold'suz da olur
//
// Kural: yalnız ölçülebilir şey çıkar; yorum üretme. Devam satırları (bir
// sonraki checkbox/başlığa kadar) yalnız `Tamamlandı/kapandı YYYY-MM-DD`
// araması için okunur.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { ItemStatus, PhaseGroup, PhaseItem, RoadmapScan } from './schema';
import { RoadmapScan as RoadmapScanSchema } from './schema';

const CHECKBOX_RE = /^(\s*)-\s\[( |x|X|~)\]\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const BOLD_TITLE_RE = /^\*\*(.+?)\*\*\s*:?\s*/;
const ID_RE = /^#([A-Za-z0-9][\w.-]*)/;
const DATE_RE = /(?:[Tt]amamlandı|[Kk]apandı)\s+(\d{4}-\d{2}-\d{2})/;

function statusOf(marker: string): ItemStatus {
    if (marker === 'x' || marker === 'X') return 'done';
    if (marker === '~') return 'partial';
    return 'open';
}

/** Başlıktan kimlik çıkarır: `#1 Konsensüs...` → `#1`; yoksa boş döner. */
function extractId(title: string): string | null {
    const m = ID_RE.exec(title);
    const captured = m?.[1];
    return captured ? `#${captured}` : null;
}

function extractTitle(rest: string): string {
    const bold = BOLD_TITLE_RE.exec(rest);
    let title = (bold?.[1] as string | undefined) ?? rest;
    // Bold içindeki sondaki iki nokta ve fazladan boşluklar temizlenir.
    title = title.replace(/\s*:\s*$/, '').trim();
    // Bold'suz satırlarda ilk cümleyi başlık kabul et (nokta/iki nokta üstünde kes).
    if (!bold) {
        const cut = title.search(/[:.](\s|$)/);
        if (cut > 0) title = title.slice(0, cut);
    }
    return title.trim();
}

function collectTitleSource(lines: string[], startIdx: number, rest: string): string {
    if (!rest.startsWith('**') || BOLD_TITLE_RE.test(rest)) return rest;
    let joined = rest;
    for (let i = startIdx + 1; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        if (!line.trim() || CHECKBOX_RE.test(line) || HEADING_RE.test(line)) break;
        joined += ` ${line.trim()}`;
        if (BOLD_TITLE_RE.test(joined)) break;
    }
    return joined;
}

/**
 * Bir checkbox bloğunun gövdesini (kendi satırı + girintili devam satırları)
 * tarih araması için birleştirir.
 */
function collectBody(lines: string[], startIdx: number): string {
    const parts: string[] = [lines[startIdx] ?? ''];
    for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (!line.trim()) break; // boş satır bloğu bitirir
        if (CHECKBOX_RE.test(line)) break;
        if (HEADING_RE.test(line)) break;
        parts.push(line);
    }
    return parts.join(' ');
}

function findCompletedAt(body: string): string | undefined {
    const m = DATE_RE.exec(body);
    return m?.[1];
}

/** Saf çekirdek — testler bunu doğrudan kullanır. */
export function scanRoadmapText(text: string, sourceFile = 'inline'): RoadmapScan {
    const lines = text.split(/\r?\n/);
    const groups: PhaseGroup[] = [];
    let currentHeading = '(başlıksız)';
    let currentGroup: PhaseGroup | null = null;
    // K2: sayaç FAZ-KAPSAMLIdır — dosya başına değil, gruba göre sıfırlanır.
    // Gerekçe: Dilim 3 delta kimliği `madde-N`e oturur; erken satır ekleme
    // sonraki fazların kimliklerini kaydırmamalı (auditi §1.5).
    let counter = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';

        const headingMatch = HEADING_RE.exec(line);
        if (headingMatch) {
            // HER başlık yeni grup sınırıdır (Dış denetim bulgusu: `## Dilim N`
            // tarzı düz faz dosyalarında maddeler ilk gruba yığılıyordu).
            // Maddesiz başlıklar sonda filtrelenir — gürültü üretmez.
            currentHeading = headingMatch[2]?.trim() ?? '';
            currentGroup = { heading: currentHeading, items: [] };
            counter = 0;
            groups.push(currentGroup);
            continue;
        }

        const cb = CHECKBOX_RE.exec(line);
        if (!cb) continue;

        counter += 1;
        const status = statusOf(cb[2] ?? ' ');
        const rest = cb[3] ?? '';
        const rawTitle = extractTitle(collectTitleSource(lines, i, rest)) || `madde ${counter}`;
        const explicitId = extractId(rawTitle);
        const body = collectBody(lines, i);

        const item: PhaseItem = {
            id: explicitId ?? `madde-${counter}`,
            title: rawTitle,
            status,
            phaseHeading: currentHeading,
            completedAt: findCompletedAt(body),
            line: i + 1,
        };

        if (currentGroup === null) {
            currentGroup = { heading: currentHeading, items: [] };
            groups.push(currentGroup);
        }
        currentGroup.items.push(item);
    }

    const scan: RoadmapScan = {
        schemaVersion: 1,
        sourceFile,
        // Maddesiz ara başlıklar ("## 6. Fazlar") çıktıyı kirletmesin.
        groups: groups.filter((g) => g.items.length > 0),
    };
    return RoadmapScanSchema.parse(scan); // kendi sözleşmemizle kendimizi vururuz
}

/** Dosya/dizin kolaylığı: tek dosya ya da dizindeki tüm .md dosyaları. */
export function scanRoadmapPath(path: string): RoadmapScan[] {
    const st = statSync(path);
    if (st.isFile()) return [scanRoadmapText(readFileSync(path, 'utf8'), path)];
    const results: RoadmapScan[] = [];
    for (const entry of readdirSync(path)) {
        const full = join(path, entry);
        if (statSync(full).isFile() && entry.endsWith('.md')) {
            results.push(scanRoadmapText(readFileSync(full, 'utf8'), full));
        }
    }
    return results;
}
