import { existsSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { cruise } from 'dependency-cruiser';
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import type { ICruiseResult, IDependency, IModule } from 'dependency-cruiser';

export interface ScanInput {
    rootDir: string;
    include?: string[];
    exclude?: string[];
}

export interface ImportGraphNode {
    path: string;
}

export interface ImportGraphEdge {
    from: string;
    to: string | null;
    resolved: boolean;
    dynamic: boolean;
    typeOnly: boolean;
    raw?: string;
}

export interface ImportScanResult {
    scannedFileCount: number;
    nodes: ImportGraphNode[];
    edges: ImportGraphEdge[];
    unresolvedCount: number;
    /**
     * Wall-clock scan duration in milliseconds. This is the single
     * non-deterministic field of the result; strip it when comparing two
     * scans for equality.
     */
    durationMs: number;
}

const DEFAULT_EXCLUDED_SEGMENTS = [
    'node_modules',
    '.git',
    '.kokpit',
    'dist',
    'coverage',
    'output',
    'build',
    '.next',
    'gitdiagram',
] as const;

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegExpSource(glob: string): string {
    return escapeRegExp(glob).replaceAll('\\*\\*', '.*').replaceAll('\\*', '[^/]*');
}

function buildExcludeRegExpSource(userExclude: readonly string[] | undefined): string {
    const segmentAlternatives = DEFAULT_EXCLUDED_SEGMENTS.map(escapeRegExp).join('|');
    const sources = [`(^|/)(${segmentAlternatives})(/|$)`];
    for (const glob of userExclude ?? []) {
        if (glob.trim()) sources.push(`(^|/)${globToRegExpSource(glob)}(/|$)`);
    }
    return sources.join('|');
}

function toPosixPath(value: string): string {
    return value.split(sep).join('/');
}

function isInScopePath(posixRelative: string, excludeRegExp: RegExp): boolean {
    return (
        posixRelative.length > 0 &&
        !posixRelative.startsWith('../') &&
        posixRelative !== '..' &&
        !isAbsolute(posixRelative) &&
        !excludeRegExp.test(posixRelative)
    );
}

function edgeFromDependency(
    fromPath: string,
    dependency: IDependency,
    excludeRegExp: RegExp,
): { edge: ImportGraphEdge; unresolvedDelta: number } {
    const resolved = dependency.couldNotResolve !== true;
    let toPath: string | null = null;
    if (resolved && dependency.coreModule !== true) {
        const candidate = toPosixPath(dependency.resolved);
        if (isInScopePath(candidate, excludeRegExp)) toPath = candidate;
    }
    return {
        edge: {
            from: fromPath,
            to: toPath,
            resolved,
            dynamic: dependency.dynamic === true,
            // Empirically dependency-cruiser 18.x signals type-only imports via
            // dependencyTypes ("type-only"); the boolean `typeOnly` attribute is
            // not populated, so both are accepted here.
            typeOnly: dependency.typeOnly === true || dependency.dependencyTypes.includes('type-only'),
            raw: dependency.module,
        },
        unresolvedDelta: resolved ? 0 : 1,
    };
}

export async function scanImportGraph(input: ScanInput): Promise<ImportScanResult> {
    const startedAtMs = performance.now();
    const rootDir = input?.rootDir?.trim() ?? '';
    if (!rootDir) {
        throw new Error('scanImportGraph: rootDir is required; pass the absolute path of the directory to scan.');
    }
    if (!isAbsolute(rootDir)) {
        throw new Error(`scanImportGraph: rootDir must be an absolute path, received: ${rootDir}`);
    }
    if (!existsSync(rootDir)) {
        throw new Error(`scanImportGraph: rootDir does not exist: ${rootDir}`);
    }
    let rootNative: string;
    try {
        rootNative = realpathSync(rootDir);
    } catch (cause) {
        throw new Error(`scanImportGraph: rootDir is not accessible: ${rootDir}`, { cause });
    }
    if (!statSync(rootNative).isDirectory()) {
        throw new Error(`scanImportGraph: rootDir is not a directory: ${rootNative}`);
    }

    const excludeRegExp = new RegExp(buildExcludeRegExpSource(input.exclude));

    // A tsconfig.json directly inside rootDir participates in resolution
    // ("paths" aliases, baseUrl). dependency-cruiser needs it in two places:
    // options.tsConfig.fileName drives the resolution plugin, and the parsed
    // config must be passed via the transpile options - without it cruiser
    // resolves relative to process.cwd() instead of rootDir.
    const tsConfigFileName = join(rootNative, 'tsconfig.json');
    let parsedTsConfig: ReturnType<typeof extractTSConfig> | undefined;
    if (existsSync(tsConfigFileName)) {
        try {
            parsedTsConfig = extractTSConfig(tsConfigFileName);
        } catch (cause) {
            throw new Error(`scanImportGraph: failed to parse ${tsConfigFileName}`, { cause });
        }
    }

    // dependency-cruiser joins its start entries onto baseDir, so the cruise
    // must start at "." and any include globs are normalized to be
    // rootDir-relative before being handed over.
    const startEntries = (input.include ?? []).map((pattern) => {
        const relativePattern = isAbsolute(pattern) ? relative(rootNative, pattern) : pattern;
        const posixPattern = toPosixPath(relativePattern);
        if (!posixPattern || posixPattern.startsWith('..') || isAbsolute(posixPattern)) {
            throw new Error(`scanImportGraph: include pattern must stay inside rootDir, received: ${pattern}`);
        }
        return posixPattern;
    });

    const cruiseOutput = await cruise(
        startEntries.length ? startEntries : ['.'],
        {
            baseDir: rootNative,
            tsPreCompilationDeps: 'specify',
            exclude: { path: excludeRegExp.source },
            ...(parsedTsConfig ? { tsConfig: { fileName: tsConfigFileName } } : {}),
        },
        undefined,
        parsedTsConfig ? { tsConfig: parsedTsConfig } : undefined,
    );

    if (typeof cruiseOutput.output === 'string' || cruiseOutput.output === null) {
        throw new Error('scanImportGraph: dependency-cruiser returned an unexpected payload instead of a cruise result.');
    }
    const cruised: ICruiseResult = cruiseOutput.output;

    const nodePaths = new Set<string>();
    const edges: ImportGraphEdge[] = [];
    let unresolvedCount = 0;

    for (const moduleEntry of cruised.modules as IModule[]) {
        // dependency-cruiser also emits phantom module entries for modules it
        // could not resolve (e.g. a missing npm package); those are edges, not
        // scanned files, so they never become nodes.
        if (moduleEntry.couldNotResolve === true) continue;
        const fromPath = toPosixPath(moduleEntry.source);
        if (!isInScopePath(fromPath, excludeRegExp)) continue;
        nodePaths.add(fromPath);
        for (const dependency of moduleEntry.dependencies) {
            const { edge, unresolvedDelta } = edgeFromDependency(fromPath, dependency, excludeRegExp);
            edges.push(edge);
            unresolvedCount += unresolvedDelta;
        }
    }

    const compareStrings = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
    const nodes = [...nodePaths].sort(compareStrings).map((path) => ({ path }));
    edges.sort(
        (left, right) =>
            compareStrings(left.from, right.from) ||
            compareStrings(left.to ?? '~', right.to ?? '~') ||
            compareStrings(left.raw ?? '', right.raw ?? '') ||
            Number(left.dynamic) - Number(right.dynamic) ||
            Number(left.typeOnly) - Number(right.typeOnly),
    );

    return {
        scannedFileCount: nodes.length,
        nodes,
        edges,
        unresolvedCount,
        durationMs: performance.now() - startedAtMs,
    };
}
