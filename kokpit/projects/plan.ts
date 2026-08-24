import { scanRoadmapText } from '../parser/roadmap';
import type { PhaseGroup } from '../parser/schema';
import type { IndexSummary } from './schema';

function ledgerHeadingStatus(heading: string): 'done' | 'partial' | 'open' {
    const normalized = heading.toLocaleUpperCase('en-US');
    if (/BLOCKED|LOCKED|WITHHELD|PREFLIGHT/.test(normalized)) return 'partial';
    if (/RUNTIME CLOSED|HISTORICAL|KAPANDI|KAPALI|\bCLOSED\b/.test(normalized)) return 'done';
    return 'open';
}

function summaryOf(groups: PhaseGroup[]): IndexSummary {
    const items = groups.flatMap((group) => group.items);
    return {
        phaseCount: groups.length,
        itemCount: items.length,
        doneCount: items.filter((item) => item.status === 'done').length,
        partialCount: items.filter((item) => item.status === 'partial').length,
        openCount: items.filter((item) => item.status === 'open').length,
    };
}

function ledgerTitle(raw: string): string {
    return raw.replace(/^\*\*(.+?)\*\*\s*:?.*$/, '$1').replace(/[*`]/g, '').trim();
}

/** Checkbox planlarını; yoksa başlık-altı kanıt defteri maddelerini indeksler. */
export function indexPlanText(markdown: string, sourceFile: string): { groups: PhaseGroup[]; summary: IndexSummary } {
    const scan = scanRoadmapText(markdown, sourceFile);
    const checkboxItems = scan.groups.flatMap((group) => group.items);
    if (checkboxItems.length) {
        return { groups: scan.groups, summary: summaryOf(scan.groups) };
    }

    const lines = markdown.split(/\r?\n/);
    let currentHeading = '';
    let currentGroup: PhaseGroup | null = null;
    const groups: PhaseGroup[] = [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex] ?? '';
        const heading = /^##\s+(.+)$/.exec(line)?.[1]?.trim();
        if (heading) {
            currentHeading = heading;
            currentGroup = { heading, items: [] };
            groups.push(currentGroup);
            continue;
        }
        if (!currentHeading || !/^\s*[-*]\s+(?!\[[ xX~]\])\S/.test(line)) continue;
        const raw = line.replace(/^\s*[-*]\s+/, '');
        const group = currentGroup;
        if (group) group.items.push({
            id: `ledger-${groups.length}-${group.items.length + 1}`,
            title: ledgerTitle(raw) || `record ${group.items.length + 1}`,
            status: ledgerHeadingStatus(currentHeading),
            phaseHeading: currentHeading,
            line: lineIndex + 1,
        });
    }
    const populated = groups.filter((group) => group.items.length > 0);
    return { groups: populated, summary: summaryOf(populated) };
}

export function summarizePlanText(markdown: string, sourceFile: string): IndexSummary {
    return indexPlanText(markdown, sourceFile).summary;
}
