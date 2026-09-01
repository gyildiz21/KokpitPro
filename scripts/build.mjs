import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const outputDirectory = resolve(root, 'dist');

await rm(outputDirectory, { recursive: true, force: true });
await build({
    absWorkingDir: root,
    entryPoints: [resolve(root, 'kokpit', 'server.ts')],
    outfile: resolve(outputDirectory, 'server.js'),
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: ['node20'],
    sourcemap: true,
    legalComments: 'none',
    logLevel: 'info',
});
