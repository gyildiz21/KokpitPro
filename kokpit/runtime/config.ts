import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

export type DeploymentMode = 'local' | 'cloud';

export interface RuntimeConfig {
    mode: DeploymentMode;
    host: string;
    port: number;
    publicOrigin: string | null;
    trustedHosts: ReadonlySet<string>;
    accessUsername: string | null;
    accessPassword: string | null;
}

function normalizedHost(value: string): string {
    return value.trim().toLowerCase().replace(/\.$/, '');
}

function parsePort(value: string | undefined): number {
    const port = Number.parseInt(value || '4173', 10);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error('PORT must be an integer between 1 and 65535.');
    }
    return port;
}

function parsePublicOrigin(value: string | undefined): URL | null {
    if (!value?.trim()) return null;
    let origin: URL;
    try {
        origin = new URL(value.trim());
    } catch {
        throw new Error('KOKPIT_PUBLIC_ORIGIN must be an absolute http(s) origin.');
    }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) {
        throw new Error('KOKPIT_PUBLIC_ORIGIN must be an absolute http(s) origin without credentials.');
    }
    if (origin.pathname !== '/' || origin.search || origin.hash) {
        throw new Error('KOKPIT_PUBLIC_ORIGIN cannot include a path, query, or fragment.');
    }
    return origin;
}

export function resolveRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
    const rawMode = env.KOKPIT_DEPLOYMENT_MODE?.trim().toLowerCase() || 'local';
    if (rawMode !== 'local' && rawMode !== 'cloud') {
        throw new Error('KOKPIT_DEPLOYMENT_MODE must be local or cloud.');
    }
    const mode: DeploymentMode = rawMode;
    const port = parsePort(env.PORT);
    const host = env.HOST?.trim() || (mode === 'cloud' ? '0.0.0.0' : '127.0.0.1');
    const publicUrl = parsePublicOrigin(env.KOKPIT_PUBLIC_ORIGIN);
    const accessUsername = env.KOKPIT_ACCESS_USERNAME?.trim() || (mode === 'cloud' ? 'kokpit' : null);
    const accessPassword = env.KOKPIT_ACCESS_PASSWORD || null;

    if (mode === 'cloud') {
        if (!publicUrl) throw new Error('KOKPIT_PUBLIC_ORIGIN is required in cloud mode.');
        if (publicUrl.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(publicUrl.hostname)) {
            throw new Error('KOKPIT_PUBLIC_ORIGIN must use https in cloud mode.');
        }
        if (!accessPassword || accessPassword.length < 24) {
            throw new Error('KOKPIT_ACCESS_PASSWORD must contain at least 24 characters in cloud mode.');
        }
    }

    const trustedHosts = new Set<string>();
    if (mode === 'local') {
        trustedHosts.add(normalizedHost(`${host}:${port}`));
        trustedHosts.add(normalizedHost(`127.0.0.1:${port}`));
        trustedHosts.add(normalizedHost(`localhost:${port}`));
    } else {
        trustedHosts.add('healthcheck.railway.app');
    }
    if (publicUrl) trustedHosts.add(normalizedHost(publicUrl.host));
    for (const candidate of (env.KOKPIT_TRUSTED_HOSTS || '').split(',')) {
        if (candidate.trim()) trustedHosts.add(normalizedHost(candidate));
    }

    return {
        mode,
        host,
        port,
        publicOrigin: publicUrl?.origin ?? null,
        trustedHosts,
        accessUsername,
        accessPassword,
    };
}

export function isTrustedHost(hostHeader: string | undefined, config: RuntimeConfig): boolean {
    return config.trustedHosts.has(normalizedHost(hostHeader || ''));
}

export function isTrustedMutationOrigin(origin: string | undefined, config: RuntimeConfig): boolean {
    if (!origin) return true;
    if (config.mode === 'cloud') return origin === config.publicOrigin;
    return new Set([
        `http://${config.host}:${config.port}`,
        `http://127.0.0.1:${config.port}`,
        `http://localhost:${config.port}`,
    ]).has(origin);
}

function safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
}

export function isRequestAuthorized(headers: IncomingHttpHeaders, config: RuntimeConfig): boolean {
    if (config.mode === 'local') return true;
    const header = headers.authorization;
    if (!header?.startsWith('Basic ') || !config.accessUsername || !config.accessPassword) return false;
    let decoded: string;
    try {
        decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    } catch {
        return false;
    }
    const separator = decoded.indexOf(':');
    if (separator < 0) return false;
    return safeEqual(decoded.slice(0, separator), config.accessUsername)
        && safeEqual(decoded.slice(separator + 1), config.accessPassword);
}

export function isCloudLocalRoute(pathname: string, method: string | undefined): boolean {
    return method === 'POST' && (pathname === '/api/projects/verify/local' || pathname === '/api/projects/local');
}

export function isCloudStaticPathAllowed(pathname: string): boolean {
    return pathname === '/' || pathname === '/arayuz-onizleme.html'
        || pathname === '/assets/map-flow.js' || pathname === '/assets/map-flow.css';
}
