import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const previewPath = resolve(root, 'arayuz-onizleme.html');
const planPath = resolve(root, 'PLAN.md');
const opening = '  <script type="text/plain" id="planSnapshot">';
const closing = '  </script>';

function expectedPreview(source, plan) {
    if (plan.includes('</script>')) {
        throw new Error('PLAN.md contains </script>; the embedded snapshot cannot be generated safely.');
    }
    const start = source.indexOf(opening);
    const end = source.indexOf(closing, start + opening.length);
    if (start < 0 || end < 0) throw new Error('planSnapshot block was not found.');

    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const normalizedPlan = plan.trimEnd().replace(/\r\n?|\n/g, eol);
    let expected = `${source.slice(0, start)}${opening}${eol}${normalizedPlan}${eol}${source.slice(end)}`;
    const tokenRenames = [
        ['--done-soft', '--st-done-soft'],
        ['--progress-soft', '--st-partial-soft'],
        ['--done', '--st-done'],
        ['--progress', '--st-partial'],
        ['--planned', '--st-open'],
        ['--danger', '--st-error'],
    ];
    for (const [legacy, canonical] of tokenRenames) {
        expected = expected.replaceAll(legacy, canonical);
    }
    return expected;
}

function assertLineEndingStability() {
    const plan = '# Plan\n\n- [ ] item\n';
    for (const eol of ['\n', '\r\n']) {
        const sample = `before${eol}${opening}${eol}stale${eol}${closing}${eol}after${eol}`;
        const expectedBlock = `${opening}${eol}${plan.trimEnd().replace(/\n/g, eol)}${eol}${closing}`;
        if (!expectedPreview(sample, plan).includes(expectedBlock)) {
            throw new Error(`Line-ending sentinel failed for ${JSON.stringify(eol)}.`);
        }
    }
}

assertLineEndingStability();

const source = readFileSync(previewPath, 'utf8');
const plan = readFileSync(planPath, 'utf8');
const expected = expectedPreview(source, plan);
const checkOnly = process.argv.includes('--check');

if (source !== expected) {
    if (checkOnly) {
        console.error('arayuz-onizleme.html is not synchronized with PLAN.md or canonical --st-* tokens.');
        process.exitCode = 1;
    } else {
        writeFileSync(previewPath, expected, 'utf8');
        console.log('arayuz-onizleme.html synchronized.');
    }
} else {
    console.log('arayuz-onizleme.html is synchronized.');
}
