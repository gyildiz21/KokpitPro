// Proje diyagram servisi — Dilim 2 dalga 2.
//
// Kalıcı proje kaydındaki gerçek veriyi (yerel kök, makbuz grupları) ölçümlü
// grafa çevirir. Dürüstlük kuralı: yerel kökü olmayan kaynak (GitHub içeriği
// yerelde yoksa) "ölçülebilir" SAYILMAZ; tahmin üretilmez, neden bildirilir.

import type { PhaseGroup } from '../parser/schema';
import { scanImportGraph } from '../importgraph/scan';
import { readLocalRevision, type LocalRevision } from '../projects/local';
import {
    buildReceiptDiagram,
    type ReceiptDiagram,
} from './receipt-adapter';
import { compileDiagramMermaid } from './compile';

export interface ProjectDiagramInput {
    projectId: string;
    /** Yalnız yerel kaynakta doludur; GitHub kaynağında yerel checkout yoktur. */
    sourceRoot?: string;
    /** Kaynak bağlantısı — yalnız github.com ise dosya linki üretir. */
    remoteUrl?: string;
    branch: string;
    commit: string;
    revisionKind?: 'commit' | 'working-tree';
    revision?: string;
    /** Sunucu yolu: canlı Git çalışma ağacı makbuzla birebir doğrulanır. */
    verifyLocalRevision?: boolean;
    groups: PhaseGroup[];
}

export type ProjectDiagramResult =
    | {
        measurable: true;
        projectId: string;
        receipt: ReceiptDiagram;
        mermaid: string;
        fileLinkBase?: string;
    }
    | {
        measurable: false;
        projectId: string;
        reason: string;
        expectedRevision?: string;
        currentRevision?: LocalRevision;
    };

/** Yalnız github.com uzak adresleri dosya linki temeli olur; diğerleri undefined. */
export function githubFileLinkBase(remoteUrl: string | undefined): string | undefined {
    if (!remoteUrl) return undefined;
    const https = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(remoteUrl);
    if (https) return `https://github.com/${https[1]}/${https[2]}`;
    const ssh = /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(remoteUrl);
    if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}`;
    return undefined;
}

export async function buildProjectDiagram(input: ProjectDiagramInput): Promise<ProjectDiagramResult> {
    if (!input.sourceRoot) {
        return {
            measurable: false,
            projectId: input.projectId,
            reason: 'no-local-checkout',
        };
    }
    let currentRevision: LocalRevision | undefined;
    if (input.verifyLocalRevision) {
        try {
            currentRevision = await readLocalRevision(input.sourceRoot);
        } catch (error) {
            return {
                measurable: false,
                projectId: input.projectId,
                reason: `revision-check-failed:${error instanceof Error ? error.message : String(error)}`,
            };
        }
        const expectedKind = input.revisionKind ?? 'commit';
        const expectedRevision = input.revision ?? input.commit;
        if (
            currentRevision.branch !== input.branch ||
            currentRevision.commit !== input.commit ||
            currentRevision.kind !== expectedKind ||
            currentRevision.revision !== expectedRevision
        ) {
            return {
                measurable: false,
                projectId: input.projectId,
                reason: 'stale-receipt',
                expectedRevision,
                currentRevision,
            };
        }
    }
    let scan;
    try {
        scan = await scanImportGraph({ rootDir: input.sourceRoot });
    } catch (error) {
        return {
            measurable: false,
            projectId: input.projectId,
            reason: error instanceof Error ? error.message : String(error),
        };
    }

    const receipt = buildReceiptDiagram({
        projectId: input.projectId,
        branch: input.branch,
        commit: input.commit,
        revisionKind: input.revisionKind ?? currentRevision?.kind ?? 'commit',
        revision: input.revision ?? currentRevision?.revision ?? input.commit,
        generatedAt: new Date().toISOString(),
        scan,
        groups: input.groups,
    });

    const revisionKind = input.revisionKind ?? currentRevision?.kind ?? 'commit';
    const fileLinkBase = revisionKind === 'commit' ? githubFileLinkBase(input.remoteUrl) : undefined;
    const compiled = compileDiagramMermaid(
        receipt.graph,
        fileLinkBase ? { fileLinkBase, branch: input.commit } : {},
    );
    if (!compiled.ok) {
        return {
            measurable: false,
            projectId: input.projectId,
            reason: `compile-failed:${compiled.reason}`,
        };
    }

    return { measurable: true, projectId: input.projectId, receipt, mermaid: compiled.mermaid, fileLinkBase };
}
