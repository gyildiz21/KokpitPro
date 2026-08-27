import { z } from 'zod';
import { PhaseGroup } from '../parser/schema';

export const ProjectSource = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('local'),
        root: z.string().min(1),
        remoteUrl: z.string().optional(),
    }),
    z.object({
        type: z.literal('github'),
        owner: z.string().min(1),
        repo: z.string().min(1),
        htmlUrl: z.string().url(),
        private: z.boolean(),
    }),
]);
export type ProjectSource = z.infer<typeof ProjectSource>;

export const ProjectNode = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    path: z.string().min(1),
    kind: z.enum(['directory', 'file']),
    status: z.enum(['done', 'partial', 'open', 'blocked']).default('done'),
    evidence: z.string().min(1),
});
export type ProjectNode = z.infer<typeof ProjectNode>;

export const IndexSummary = z.object({
    phaseCount: z.number().int().nonnegative(),
    itemCount: z.number().int().nonnegative(),
    doneCount: z.number().int().nonnegative(),
    partialCount: z.number().int().nonnegative(),
    openCount: z.number().int().nonnegative(),
});
export type IndexSummary = z.infer<typeof IndexSummary>;

export const IndexReceipt = z.object({
    indexedAt: z.string().datetime(),
    commit: z.string().min(1),
    branch: z.string().min(1),
    /**
     * `commit` yalnız temiz bir çalışma ağacını; `working-tree` ise yeniden
     * üretilebilir yerel parmak izini temsil eder. Eski kayıtlar bu alanları
     * taşımayabilir; tüketici onları temiz-commit varsaymak yerine canlı Git
     * durumuyla doğrular.
     */
    revisionKind: z.enum(['commit', 'working-tree']).optional(),
    revision: z.string().min(1).optional(),
    planPath: z.string().min(1),
    planMarkdown: z.string(),
    groups: z.array(PhaseGroup).default([]),
    summary: IndexSummary,
    nodes: z.array(ProjectNode),
});
export type IndexReceipt = z.infer<typeof IndexReceipt>;

export const ProjectRecord = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: ProjectSource,
    branch: z.string().min(1),
    authMode: z.enum(['local', 'github-app', 'server-token', 'anonymous']),
    connectionState: z.enum(['ready', 'stale', 'error']),
    index: IndexReceipt,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    lastError: z.string().nullable().default(null),
});
export type ProjectRecord = z.infer<typeof ProjectRecord>;

export const RegistryFile = z.object({
    version: z.literal(1),
    activeProjectId: z.string().nullable(),
    projects: z.array(ProjectRecord),
});
export type RegistryFile = z.infer<typeof RegistryFile>;
