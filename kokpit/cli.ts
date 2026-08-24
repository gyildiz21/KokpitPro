#!/usr/bin/env tsx
// Kokpit CLI — Dilim 1 kabul aracı.
//
// Kullanım:
//   npx tsx kokpit/cli.ts --roadmap <yol.md> [--phases <dizin>] [--pretty]
//
// Örnek (MethodLogos'u gerçek veriyle sınamak — kod bağı YOK, sadece girdi):
//   npx tsx kokpit/cli.ts --roadmap "../MethodLogos_Pro/ROADMAP.md" --pretty
//   npx tsx kokpit/cli.ts --roadmap "../MethodLogos_Pro/ROADMAP.md" \
//                        --phases "../MethodLogos_Pro/.agents/phases"
//
// Not: JSON çıktısının anahtarları bilinçli olarak İngilizce/sabit — makine
// sözleşmesidir; yalnız UI metinleri yerelleşir (bkz. DESIGN.md §Dil Politikası).

import { parseArgs } from 'node:util';
import { statSync } from 'fs';
import { scanRoadmapPath, scanPhaseDirectory } from './parser/index.js';

function usage(): string {
    return [
        'KokpitPro CLI (Dilim 1)',
        '',
        'Kullanım:',
        '  npx tsx kokpit/cli.ts --roadmap <dosya.md|dizin> [--phases <dizin>] [--pretty]',
        '',
        'Örnek:',
        '  npx tsx kokpit/cli.ts --roadmap ../MethodLogos_Pro/ROADMAP.md --pretty',
    ].join('\n');
}

export function runCli(argv: readonly string[]): { code: number; stdout?: string; stderr?: string } {
    let parsed;
    try {
        parsed = parseArgs({
            args: [...argv],
            options: {
                roadmap: { type: 'string' },
                phases: { type: 'string' },
                pretty: { type: 'boolean', default: false },
                help: { type: 'boolean', short: 'h', default: false },
            },
            strict: true,
        });
    } catch (err) {
        return { code: 2, stderr: `Hatalı argüman: ${(err as Error).message}\n\n${usage()}` };
    }

    if (parsed.values.help || (!parsed.values.roadmap && !parsed.values.phases)) {
        return { code: parsed.values.help ? 0 : 2, stdout: usage() };
    }

    const out: Record<string, unknown> = {};
    try {
        if (parsed.values.roadmap) {
            const target = parsed.values.roadmap;
            // Var olmayan yol için net hata (sessiz boş sonuç yerine).
            statSync(target);
            out.roadmap = scanRoadmapPath(target);
        }
        if (parsed.values.phases) {
            const dir = parsed.values.phases;
            if (!statSync(dir).isDirectory()) {
                return { code: 2, stderr: `--phases bir dizin olmalı: ${dir}` };
            }
            out.phaseFiles = scanPhaseDirectory(dir);
        }
        const json = JSON.stringify(out, null, parsed.values.pretty ? 2 : undefined);
        return { code: 0, stdout: json };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { code: 1, stderr: `Hata: ${msg}` };
    }
}

// Doğrudan çalıştırma (test importu değilse).
if (process.argv[1] && /cli\.(ts|js)$/.test(process.argv[1])) {
    const result = runCli(process.argv.slice(2));
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exitCode = result.code;
}
