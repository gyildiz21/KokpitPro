import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preview = readFileSync(resolve(root, 'arayuz-onizleme.html'), 'utf8');
const spec = readFileSync(resolve(root, 'UI-SPEC.md'), 'utf8');
const plan = readFileSync(resolve(root, 'PLAN.md'), 'utf8');

describe('UI-SPEC v0.9 persistent project lifecycle', () => {
    it('keeps the complete project lifecycle visible in the canonical spec and plan', () => {
        expect(spec).toContain('## §12 · Proje Merkezi, bağlantılar ve veri izolasyonu');
        expect(spec).toContain('Kaynak → Doğrula → İndeksle → Hazır');
        expect(spec).toContain('### §12.6 Proje-bazlı veri izolasyonu');
        expect(spec).toContain('### §12.10 Kabul senaryoları');
        expect(plan).toContain('## Dilim 2.1 · Proje Merkezi + Repo Bağlantı Yaşam Döngüsü');
        expect(plan).toContain('**GitHub App / GitHub Contents:** seçili repolar');
        expect(plan).toContain('`Contents: read`');
    });

    it('renders catalog, workspace, comparison, and both persistent connection sources', () => {
        expect(preview).toContain('id="projectsScreen"');
        expect(preview).toContain('id="workspaceScreen"');
        expect(preview).toContain('id="compareScreen"');
        expect(preview).toContain('id="connectDialog"');
        expect(preview).toContain('data-connect-source="local"');
        expect(preview).toContain('data-connect-source="github"');
        expect(preview).toContain('apiRequest("/api/projects")');
        expect(preview).toContain('/api/projects/verify/${connectState.source}');
        expect(preview).toContain('/api/projects/${connectState.source}');
        expect(preview).toContain('function renderTimeline()');
        expect(preview).toContain('projectId:${project.id}');
        expect(preview).toContain('Kayıtlar diskte kalıcıdır');
    });

    it('does not restore the old mixed-project shell', () => {
        expect(preview).not.toContain('MethodLogos_Pro / master');
        expect(preview).not.toContain('KARMA VERİ');
        expect(preview).not.toContain('12/62 örnek madde');
        expect(preview).not.toContain('Önizleme kaydı eklendi; gerçek repo okunmadı.');
    });

    it('clears the selected evidence before activating another project', () => {
        const activation = /async function activateProject\([\s\S]+?\n    }/.exec(preview)?.[0] ?? '';
        expect(activation).toContain('activeProjectId = projectId;');
        expect(activation).toContain('resetInspector();');
        expect(activation.indexOf('resetInspector();')).toBeLessThan(activation.indexOf('await loadPlanData();'));
        expect(preview).toContain('function resetInspector()');
        expect(preview).toContain("$('#inspectorBody').innerHTML = `<div class=\"inspector-empty\"");
    });

    it('keeps the file-mode PLAN snapshot and status tokens synchronized', () => {
        const snapshot = /<script type="text\/plain" id="planSnapshot">\r?\n([\s\S]*?)\r?\n  <\/script>/.exec(preview)?.[1];
        expect(snapshot?.replaceAll('\r\n', '\n')).toBe(plan.trimEnd().replaceAll('\r\n', '\n'));
        expect(preview).toContain('--st-done');
        expect(preview).toContain('--st-partial');
        expect(preview).toContain('--st-open');
        expect(preview).not.toMatch(/--(?:done|progress|planned|danger)(?:-soft)?\b/);
    });
});
