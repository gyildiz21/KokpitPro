// Üretim dosyası ölçümü — Dilim 4.
//
// Verilen yolları ölçüm köküne göre çözer, gerçek boyut/satır sayısını ölçer.
// Güvenlik sözleşmesi: her dosyanın realpath'i çözülür; kök dışına çözülen
// hiçbir yol takip edilmez (outsideRoot sayacı artar, içerik sızdırılmaz).
// 8 MiB üstü dosyalarda satır SAYILMAZ (lines=null); bayt her zaman
// statSync'den gelir. Ortam değişkenine bağımlılık yoktur; aynı girdi her
// koşumda aynı sonucu verir. Okunamayan yollar `unreadable` sayılır ve
// stats haricine HİÇ girmez — tüketici eksik girdiyi ölçülemezlik olarak
// okur.

import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';

export interface ProductionFileStat {
    path: string;
    /** Satır sayısı; yalnız 8 MiB üstü dosyalarda sayılamadığı için null. */
    lines: number | null;
    bytes: number;
}

export interface ProductionFileStatResult {
    stats: Map<string, ProductionFileStat>;
    unreadable: number;
    outsideRoot: number;
}

/** Satır sayımı için içerği okunacak en büyük dosya: 8 MiB. */
const MAX_LINES_SCAN_BYTES = 8 * 1024 * 1024;

function isInside(root: string, target: string): boolean {
    const rel = relative(root, target);
    return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

export function measureProductionFileStats(
    rootDir: string,
    paths: readonly string[],
): ProductionFileStatResult {
    const stats = new Map<string, ProductionFileStat>();
    let unreadable = 0;
    let outsideRoot = 0;

    let rootNative: string;
    try {
        rootNative = realpathSync(rootDir);
    } catch (cause) {
        throw new Error(`measureProductionFileStats: rootDir is not accessible: ${rootDir}`, { cause });
    }
    if (!statSync(rootNative).isDirectory()) {
        throw new Error(`measureProductionFileStats: rootDir is not a directory: ${rootNative}`);
    }

    // Yinelenen girdi yolu tek kez ölçülür; sayaçlar çift artmaz.
    for (const path of new Set(paths)) {
        // Girdi yolları posix-biçimli ve köke göredir; segment segment birleştir.
        const candidate = join(rootNative, ...path.split('/'));
        let real: string;
        try {
            real = realpathSync(candidate);
        } catch {
            unreadable += 1;
            continue;
        }
        // Symlink dâhil her şey kök içine çözülmek zorundadır; aksi hâlde takip edilmez.
        if (!isInside(rootNative, real)) {
            outsideRoot += 1;
            continue;
        }
        let bytes: number;
        try {
            const info = statSync(real);
            if (!info.isFile()) {
                unreadable += 1;
                continue;
            }
            bytes = info.size;
        } catch {
            unreadable += 1;
            continue;
        }
        let lines: number | null = null;
        if (bytes <= MAX_LINES_SCAN_BYTES) {
            try {
                const content = readFileSync(real);
                let count = 0;
                for (const byte of content) {
                    if (byte === 0x0a) count += 1;
                }
                if (content.length > 0 && content[content.length - 1] !== 0x0a) count += 1;
                lines = count;
            } catch {
                unreadable += 1;
                continue;
            }
        }
        stats.set(path, { path, lines, bytes });
    }

    return { stats, unreadable, outsideRoot };
}
