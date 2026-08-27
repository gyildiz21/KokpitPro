import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { diagramGraphSchema, type DiagramGraph } from '../diagram/graph-schema';

const DeltaGraphSnapshot = z.object({
    schemaVersion: z.literal(1),
    projectId: z.string().min(1),
    revision: z.string().min(1),
    graph: diagramGraphSchema,
}).strict();

const DeltaHistoryFile = z.object({
    version: z.literal(1),
    projects: z.record(z.array(DeltaGraphSnapshot).max(2)),
}).strict();

type DeltaHistoryFileType = z.infer<typeof DeltaHistoryFile>;

const EMPTY_HISTORY: DeltaHistoryFileType = { version: 1, projects: {} };

/** Son iki ölçülmüş grafı atomik ve proje-izole biçimde saklar. */
export class DeltaHistoryStore {
    readonly dataDir: string;
    readonly filePath: string;

    constructor(dataDir = process.env.KOKPIT_DATA_DIR || resolve(process.cwd(), '.kokpit', 'data')) {
        this.dataDir = resolve(dataDir);
        this.filePath = join(this.dataDir, 'delta-history.json');
    }

    read(): DeltaHistoryFileType {
        if (!existsSync(this.filePath)) return structuredClone(EMPTY_HISTORY);
        return DeltaHistoryFile.parse(JSON.parse(readFileSync(this.filePath, 'utf8')));
    }

    record(projectId: string, revision: string, graph: DiagramGraph): void {
        const state = this.read();
        const current = state.projects[projectId] ?? [];
        if (current[0]?.revision === revision) return;
        state.projects[projectId] = [
            DeltaGraphSnapshot.parse({ schemaVersion: 1, projectId, revision, graph }),
            ...current.filter((entry) => entry.revision !== revision),
        ].slice(0, 2);
        this.write(state);
    }

    baselineFor(projectId: string, currentRevision: string): { graph: DiagramGraph } | null {
        const snapshots = this.read().projects[projectId] ?? [];
        const currentIndex = snapshots.findIndex((entry) => entry.revision === currentRevision);
        if (currentIndex < 0) return null;
        const baseline = snapshots[currentIndex + 1];
        return baseline ? { graph: baseline.graph } : null;
    }

    remove(projectId: string): boolean {
        const state = this.read();
        if (!state.projects[projectId]) return false;
        delete state.projects[projectId];
        this.write(state);
        return true;
    }

    private write(state: DeltaHistoryFileType): void {
        const validated = DeltaHistoryFile.parse(state);
        mkdirSync(this.dataDir, { recursive: true });
        const temporary = `${this.filePath}.${process.pid}.tmp`;
        try {
            writeFileSync(temporary, `${JSON.stringify(validated, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
            renameSync(temporary, this.filePath);
            chmodSync(this.filePath, 0o600);
        } finally {
            if (existsSync(temporary)) unlinkSync(temporary);
        }
    }
}
