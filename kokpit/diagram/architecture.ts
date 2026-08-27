import type { ImportGraphEdge } from '../importgraph/scan';
import type { DiagramGraphEdge, DiagramGroup } from './graph-schema';

export type ArchitectureGroupId =
    | 'interface'
    | 'runtime'
    | 'analysis'
    | 'integration'
    | 'data'
    | 'automation'
    | 'delivery'
    | 'shared';

interface ArchitectureRule extends Omit<DiagramGroup, 'id'> {
    id: ArchitectureGroupId;
    tokens: ReadonlySet<string>;
}

/**
 * Yol-tabanlı ve tamamen deterministik mimari sınıflandırma. Bu etiketler AI
 * yorumu değildir; yalnız depo yolundaki açık segmentleri daha okunur kümelere
 * toplar. Sıra aynı zamanda çakışmalardaki önceliktir.
 */
const ARCHITECTURE_RULES: readonly ArchitectureRule[] = [
    {
        id: 'interface',
        label: 'Interface',
        description: 'User-facing pages, components, views and client UI.',
        tokens: new Set(['ui', 'frontend', 'client', 'components', 'pages', 'views', 'screens']),
    },
    {
        id: 'runtime',
        label: 'Backend & API',
        description: 'Server runtime, API routes, handlers and functions.',
        tokens: new Set(['server', 'backend', 'api', 'routes', 'handlers', 'functions', 'controllers']),
    },
    {
        id: 'analysis',
        label: 'Analysis Engine',
        description: 'Parsers, scanners, compilers and diagram analysis.',
        tokens: new Set(['analysis', 'analyzer', 'analysers', 'analyzers', 'parser', 'parsers', 'diagram', 'importgraph', 'compiler', 'scanner']),
    },
    {
        id: 'integration',
        label: 'Services & Integrations',
        description: 'Project adapters, services, connectors and providers.',
        tokens: new Set(['projects', 'project', 'services', 'service', 'adapters', 'adapter', 'connectors', 'connector', 'integrations', 'integration', 'providers', 'provider']),
    },
    {
        id: 'data',
        label: 'Data & Storage',
        description: 'Persistence, repositories, models, schemas and migrations.',
        tokens: new Set(['data', 'database', 'db', 'storage', 'repositories', 'repository', 'models', 'model', 'migrations', 'migration']),
    },
    {
        id: 'automation',
        label: 'Automation & Workflows',
        description: 'Workflows, agents, workers, jobs and queues.',
        tokens: new Set(['automation', 'automations', 'workflows', 'workflow', 'agents', 'agent', 'workers', 'worker', 'jobs', 'job', 'queues', 'queue']),
    },
    {
        id: 'delivery',
        label: 'Build & Delivery',
        description: 'Build, configuration, infrastructure and developer tooling.',
        tokens: new Set(['scripts', 'script', 'config', 'configs', 'infra', 'infrastructure', 'deploy', 'deployment', 'ci', 'tools', 'tooling']),
    },
    {
        id: 'shared',
        label: 'Shared Core',
        description: 'Shared modules without a more specific path-derived role.',
        tokens: new Set(),
    },
] as const;

const RULE_BY_ID = new Map(ARCHITECTURE_RULES.map((rule) => [rule.id, rule]));

function segmentTokens(segment: string): string[] {
    return segment
        .replace(/\.[^.]+$/u, '')
        .split(/[-_.]+/u)
        .filter(Boolean);
}

function pathTokenSets(path: string): { directory: Set<string>; leaf: Set<string> } {
    const segments = path
        .replace(/\\/g, '/')
        .toLowerCase()
        .split('/')
        .filter(Boolean);
    const leafSegment = segments.pop() ?? '';
    return {
        directory: new Set(segments.flatMap(segmentTokens)),
        leaf: new Set(segmentTokens(leafSegment)),
    };
}

export function architectureGroupIdForPath(path: string): ArchitectureGroupId {
    const tokens = pathTokenSets(path);
    // Dizin rolü dosya adından daha güçlüdür: services/api.ts bir servis
    // adaptörüdür; yalnız `api` adlı dosya yüzünden backend olarak sunulmaz.
    for (const rule of ARCHITECTURE_RULES) {
        if (rule.id === 'shared') continue;
        if ([...rule.tokens].some((token) => tokens.directory.has(token))) return rule.id;
    }
    for (const rule of ARCHITECTURE_RULES) {
        if (rule.id === 'shared') continue;
        if ([...rule.tokens].some((token) => tokens.leaf.has(token))) return rule.id;
    }
    return 'shared';
}

export function architectureGroupsForPaths(paths: readonly string[]): DiagramGroup[] {
    const used = new Set(paths.map(architectureGroupIdForPath));
    return ARCHITECTURE_RULES
        .filter((rule) => used.has(rule.id))
        .map(({ id, label, description }) => ({ id, label, description }));
}

/** Ölçümün gerçekten kanıtladığı ilişki dilini üretir; davranış tahmini yapmaz. */
export function measuredImportPresentation(
    edge: ImportGraphEdge,
    fromGroupId: string,
    toGroupId: string,
): Pick<DiagramGraphEdge, 'label' | 'style'> {
    if (edge.dynamic) return { label: 'dynamic import', style: 'dashed' };
    if (edge.typeOnly) return { label: 'type import', style: 'dashed' };
    if (fromGroupId !== toGroupId) return { label: 'imports', style: 'solid' };
    return { style: 'solid' };
}

export function architectureGroupById(id: string): DiagramGroup | undefined {
    const rule = RULE_BY_ID.get(id as ArchitectureGroupId);
    if (!rule) return undefined;
    return { id: rule.id, label: rule.label, description: rule.description };
}
