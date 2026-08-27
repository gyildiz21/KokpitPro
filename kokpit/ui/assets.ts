import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';

export interface UiAssets {
    mapFlowJs: string;
    mapFlowCss: string;
}

const require = createRequire(import.meta.url);

export async function buildUiAssets(root: string): Promise<UiAssets> {
    const result = await build({
        entryPoints: [resolve(root, 'kokpit', 'ui', 'map-flow.tsx')],
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        target: ['es2022'],
        outfile: 'map-flow.js',
        jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        legalComments: 'none',
    });
    const javascript = result.outputFiles.find((file) => file.path.endsWith('.js'));
    if (!javascript) throw new Error('Map Flow browser bundle was not produced.');
    const stylesheetPath = require.resolve('@xyflow/react/dist/style.css');
    return {
        mapFlowJs: javascript.text,
        mapFlowCss: readFileSync(stylesheetPath, 'utf8'),
    };
}
