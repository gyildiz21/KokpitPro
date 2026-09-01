import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preview = readFileSync(resolve(root, 'arayuz-onizleme.html'), 'utf8');
const mapFlowSource = readFileSync(resolve(root, 'kokpit/ui/map-flow.tsx'), 'utf8');
const spec = readFileSync(resolve(root, 'UI-SPEC.md'), 'utf8');
const plan = readFileSync(resolve(root, 'PLAN.md'), 'utf8');

describe('UI-SPEC v0.9 persistent project lifecycle', () => {
    it('keeps the accepted v1.2 Dilim 5.2 contract and timeline identity visible', () => {
        expect(spec).toContain('### §10.9 Dilim 5.2 — Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit');
        expect(spec).toContain('**tespit → anlama → eylem → yeniden ölçüm/doğrulama**');
        expect(plan).toContain('## Dilim 5.2 · Gerçek Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit');
        expect(preview).toContain('"Dilim-5.2": "Real-corpus decision integrity and explainable cockpit"');
        expect(preview).toContain('UI-SPEC v1.2 · persistent');
    });

    it('keeps the complete project lifecycle visible in the canonical spec and plan', () => {
        expect(spec).toContain('## §12 · Proje Merkezi, bağlantılar ve veri izolasyonu');
        expect(spec).toContain('Kaynak → Doğrula → İndeksle → Hazır');
        expect(spec).toContain('### §12.6 Proje-bazlı veri izolasyonu');
        expect(spec).toContain('### §12.10 Kabul senaryoları');
        expect(plan).toContain('## Dilim 2.1 · Proje Merkezi + Repo Bağlantı Yaşam Döngüsü');
        expect(plan).toContain('**GitHub App / GitHub Contents (`kokpit/projects/github.ts`):** seçili repolar');
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
        expect(preview).toContain('function renderEmptyInspector()');
    });

    it('binds phase explanations and resets inspector context in both view directions', () => {
        const phaseInspector = /function renderPhaseInspector\([\s\S]+?\n    }/.exec(preview)?.[0] ?? '';
        const viewSwitch = /function showView\([\s\S]+?\n    }/.exec(preview)?.[0] ?? '';
        expect(phaseInspector).toContain('data-explain-card="plan-slice:${escapeHtml(group.id)}"');
        expect(phaseInspector).toContain('startExplain("plan-slice", group.id)');
        expect(preview).toContain('function inspectorSelectionBelongsToView(selection, view)');
        expect(viewSwitch).toContain('!inspectorSelectionBelongsToView(selectedNode, view)');
        expect(preview).toContain('explainLimitations: "Açık sınırlar"');
        expect(preview).toContain('explainLimitations: "Open limitations"');
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

describe('Dilim 2 real-map wiring', () => {
    it('fetches the measured project diagram and resets it on project switch', () => {
        expect(preview).toContain('document.body.dataset.appReady = "true";');
        expect(preview).toContain('document.body.dataset.appReady = "error";');
        expect(preview).toContain('apiRequest(`/api/projects/${encodeURIComponent(projectId)}/diagram`)');
        const activation = /async function activateProject\([\s\S]+?\n    }/.exec(preview)?.[0] ?? '';
        expect(activation).toContain('diagramState = null;');
        expect(activation.indexOf('resetInspector();')).toBeLessThan(activation.indexOf('await loadPlanData();'));
        expect(activation).toContain('await loadDiagramData();');
        expect(preview).toContain('async function loadDiagramData()');
    });

    it('keeps sample nodes honestly labeled and paints statuses only through evidence kinds', () => {
        expect(preview).toContain('<span class="sample-label">${escapeHtml(t("sample"))}</span>');
        expect(preview).toContain('function mapNodeStatus(evidence)');
        expect(preview).toContain("evidence.evidenceKind === \"plan-path-match\"");
        expect(preview).toContain('t("unmeasuredStatus")');
        expect(preview).not.toMatch(/style="[^"]*#[0-9a-fA-F]{3,8}/);
    });

    it('exposes the deterministic mermaid export and evidence receipt inspector', () => {
        expect(preview).toContain('id="mermaidExport"');
        expect(preview).toContain('id="mermaidSource"');
        expect(preview).toContain('id="copyMermaid"');
        expect(preview).toContain('function renderRealNodeInspector(id)');
        expect(preview).toContain('evidenceKindLabel(evidence.evidenceKind)');
        expect(preview).toContain('projectId:<code>${escapeHtml(evidence.projectId)}</code>');
    });

    it('uses a measured React Flow layout instead of recycling five absolute slots', () => {
        expect(preview).toContain('/assets/map-flow.js');
        expect(preview).toContain('window.KokpitMapFlow.render({');
        expect(preview).toContain('groups: (receipt.graph.groups || []).map');
        expect(preview).toContain('groupId: node.groupId');
        expect(preview).toContain('edges: receipt.graph.edges.map');
        expect(preview).toContain('function architectureGroupLabel(group)');
        expect(preview).toContain('function architectureEdgeLabel(label)');
        expect(preview).toContain('otherGroupLabel: t("architectureGroupShared")');
        expect(mapFlowSource).toContain('<Handle type="target" position={Position.Left}');
        expect(mapFlowSource).toContain('<Handle type="source" position={Position.Right}');
        expect(mapFlowSource).toContain('fitViewOptions={{ padding: 0.12, minZoom: 0.25, maxZoom: 0.9 }}');
        expect(preview).not.toContain('const slots = ["node-pos-1"');
        expect(preview).not.toContain('function renderRealWires');
    });

    it('binds group/edge inspectors and receipt-scoped view persistence', () => {
        expect(preview).toContain('onSelectGroup: selectMapGroup');
        expect(preview).toContain('onSelectEdge: selectMapEdge');
        expect(preview).toContain('function renderGroupInspector(id)');
        expect(preview).toContain('function renderEdgeInspector(id)');
        expect(preview).toContain('function mapStateKey()');
        expect(preview).toContain('kokpit-map-state:${activeProjectId}:${revision}');
        expect(preview).toContain('viewport: viewport || previous?.viewport || null');
        expect(preview).toContain('search: mapSearchQuery');
        expect(preview).toContain('function nodeMatchesMapSearch(node)');
        expect(preview).toContain('id="mapSearch"');
        expect(preview).toContain('restoreMapContext();');
        expect(preview).toContain("if ($('#workspaceScreen').hidden) return;");
        expect(mapFlowSource).toContain('data-map-group-id={groupId}');
        expect(mapFlowSource).toContain('edgesFocusable');
        expect(mapFlowSource).toContain('onViewportChange');
        const renderApi = /render\(payload: MapFlowPayload\) \{[\s\S]+?\n    \},/.exec(mapFlowSource)?.[0] ?? '';
        expect(renderApi).not.toContain('instance = null;');
        expect(renderApi).toContain('next.setViewport(payload.initialViewport)');
        expect(renderApi).toContain('instance.setViewport(payload.initialViewport)');
    });

    it('shows phase code/test mappings, GO gates, and stale-receipt recovery', () => {
        expect(preview).toContain('receipt.itemMappings');
        expect(preview).toContain('receipt.unmatchedPlanItems');
        expect(preview).toContain('data-node-jump=');
        expect(preview).toContain('group.gateStatus === "waiting-go"');
        expect(preview).toContain('data-map-reindex=');
        expect(preview).toContain('evidence.revisionKind === "commit"');
    });
});

describe('Dilim 5 compliance wiring', () => {
    it('keeps full TR/EN dictionary parity across every i18n assign block', () => {
        const blocks = [...preview.matchAll(/Object\.assign\(I18N\.(tr|en), \{([\s\S]*?)\}\);/g)];
        const keys = { tr: new Set<string>(), en: new Set<string>() };
        for (const block of blocks) {
            const language = block[1] as 'tr' | 'en';
            for (const match of (block[2] ?? '').matchAll(/([A-Za-z0-9_]+)\s*:\s*(?:"|'|`)/g)) keys[language].add(match[1] ?? '');
        }
        for (const key of keys.tr) expect(keys.en.has(key), `EN missing key: ${key}`).toBe(true);
        for (const key of keys.en) expect(keys.tr.has(key), `TR missing key: ${key}`).toBe(true);
        expect(keys.tr.has('queueClosed')).toBe(true);
        expect(keys.tr.has('closureJustificationLabel')).toBe(true);
    });

    it('draws the compliance surface only from the live report; sample rows are gone', () => {
        expect(preview).toContain('id="issueList"');
        expect(preview).toContain('async function loadCompliance()');
        expect(preview).toContain('/compliance/close`');
        expect(preview).not.toContain('ISSUE_DATA');
        expect(preview).not.toContain('data-issue=');
        expect(preview).not.toContain('Örnek uyum kayıtları');
        expect(preview).toContain("measurement === \"unmeasured\"");
        expect(preview).toContain("measurement === \"partial\"");
        expect(preview).toContain('report.coverage');
        const activation = /async function activateProject\([\s\S]+?\n    }/.exec(preview)?.[0] ?? '';
        expect(activation).toContain('complianceState = null;');
        expect(activation).toContain('void loadCompliance();');
    });

    it('keeps the closure flow honest: justification and alias are mandatory, disabled until both exist', () => {
        expect(preview).toContain('data-closure-id="${escapeHtml(violationId)}"');
        expect(preview).toContain('submit.disabled = !(justification && by)');
        expect(preview).toContain('kokpit-compliance-by');
        expect(preview).toContain('closureSavedToast');
    });
});

describe('Dilim 3 delta wiring', () => {
    it('fetches the measured delta for the composite item id and never fakes failures', () => {
        const loader = /async function loadDelta\([\s\S]+?\n    }/.exec(preview)?.[0] ?? '';
        expect(loader).toContain('/delta?phase=${encodeURIComponent(phaseHeading)}&item=${encodeURIComponent(itemId)}');
        // HTTP hatası dürüst boş duruma döner; örnek payload gerçek gibi çizilmez.
        expect(preview).not.toMatch(/"mode":\s*"measured"/);
        expect(preview).toMatch(/status: "empty"/);
    });

    it('mirrors the roadmap gate rule: item-body legends are not gates', () => {
        // Checkbox gövdesi işareti + boş satır/başlık sıfırlaması roadmap.ts nöbetçisinin aynasıdır.
        expect(preview).toContain('insideItemBody = true;');
        expect(preview).toContain('!insideItemBody && /\\bGO\\b');
    });

    it('scopes delta state to the active project and resets on switch', () => {
        expect(preview).toContain('function activeDelta()');
        const activation = /async function activateProject\([\s\S]+?\n    }/.exec(preview)?.[0] ?? '';
        expect(activation).toContain('deltaState = null;');
        expect(activation.indexOf('resetInspector();')).toBeLessThan(activation.indexOf('await loadPlanData();'));
    });

    it('renders both inspector and panel delta surfaces with proposed-node honesty', () => {
        expect(preview).toContain('[data-inspector-delta-card]');
        expect(preview).toContain('is-proposed');
        expect(preview).toContain('highlightNodeIds');
        // Kesikli öneri düğümleri ÖNERİ/PROPOSED metni taşır; renk tek başına anlam vermez.
        expect(preview).toContain('proposalBadge');
    });
});

describe('Dilim 4 remap wiring', () => {
    it('fetches the live remap report per project and resets it on switch', () => {
        expect(preview).toContain('apiRequest(`/api/projects/${encodeURIComponent(projectId)}/remap`)');
        expect(preview).toContain('function activeRemap()');
        expect(preview).toContain('async function loadRemap()');
        const activation = /async function activateProject\([\s\S]+?\n    }/.exec(preview)?.[0] ?? '';
        expect(activation).toContain('remapState = null;');
        expect(activation).toContain('resetRemapPanel();');
        expect(activation).toContain('void loadRemap();');
    });

    it('renders suggestion cards that reuse the proposal badge evidence language', () => {
        expect(preview).toContain('data-remap-card=');
        expect(preview).toContain('map-flow-node__badge');
        expect(preview).toContain('t("proposalBadge")');
        expect(preview).toContain('data-node-jump="${escapeHtml(suggestion.nodeId)}"');
        expect(preview).toContain('t("remapNotRendered")');
    });

    it('never ships apply, move, or auto-fix actions in the suggestion panel', () => {
        // Bu bir öneri panelidir: hiçbir şey otomatik değişmez (UI-SPEC §5.3, DESIGN D7).
        expect(preview).not.toContain('data-remap-apply');
        expect(preview).not.toContain('data-remap-move');
        expect(preview).not.toContain('data-remap-autofix');
        expect(preview).not.toContain('otomatik düzelt');
        expect(preview).not.toContain('Otomatik düzelt');
    });

    it('keeps the honest empty and not-rendered language in both dictionaries', () => {
        const blocks = [...preview.matchAll(/Object\.assign\(I18N\.(tr|en), \{([\s\S]*?)\}\);/g)];
        const keys = { tr: new Set<string>(), en: new Set<string>() };
        for (const block of blocks) {
            const language = block[1] as 'tr' | 'en';
            for (const match of (block[2] ?? '').matchAll(/([A-Za-z0-9_]+)\s*:\s*(?:"|'|`)/g)) keys[language].add(match[1] ?? '');
        }
        for (const key of ['remapToggle', 'remapPanelAria', 'remapEmptyTitle', 'remapEmptyBody', 'remapNotRendered', 'remapProposalNote']) {
            expect(keys.tr.has(key), `TR missing key: ${key}`).toBe(true);
            expect(keys.en.has(key), `EN missing key: ${key}`).toBe(true);
        }
        expect(preview).toContain('t("remapEmptyTitle")');
        expect(preview).toContain('t("remapEmptyBody")');
    });

    it('reports unmeasurable states honestly with stale reindex but no fake success', () => {
        expect(preview).toContain('measurement === "unmeasurable"');
        expect(preview).toContain('REMAP_REASON_KEYS[reason.code] || reason.code');
        expect(preview).toContain('data-remap-status="unmeasurable"');
        expect(preview).toContain('data-map-reindex="${escapeHtml(state.projectId)}"');
        expect(preview).toContain('status: "error"');
    });
});
