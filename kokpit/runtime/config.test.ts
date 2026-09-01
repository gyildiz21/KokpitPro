import { describe, expect, it } from 'vitest';
import {
    isCloudLocalRoute,
    isCloudStaticPathAllowed,
    isRequestAuthorized,
    isTrustedHost,
    isTrustedMutationOrigin,
    resolveRuntimeConfig,
} from './config';

function cloud(overrides: NodeJS.ProcessEnv = {}) {
    return resolveRuntimeConfig({
        KOKPIT_DEPLOYMENT_MODE: 'cloud',
        KOKPIT_PUBLIC_ORIGIN: 'https://kokpit.example',
        KOKPIT_ACCESS_PASSWORD: 'a-secure-staging-password-123',
        ...overrides,
    });
}

describe('runtime deployment boundary', () => {
    it('keeps local defaults local-only', () => {
        const config = resolveRuntimeConfig({});
        expect(config.mode).toBe('local');
        expect(config.host).toBe('127.0.0.1');
        expect(isTrustedHost('localhost:4173', config)).toBe(true);
        expect(isTrustedHost('kokpit.example', config)).toBe(false);
        expect(isRequestAuthorized({}, config)).toBe(true);
    });

    it('fails closed when cloud origin or access secret is absent or weak', () => {
        expect(() => resolveRuntimeConfig({ KOKPIT_DEPLOYMENT_MODE: 'cloud' })).toThrow(/PUBLIC_ORIGIN/);
        expect(() => resolveRuntimeConfig({
            KOKPIT_DEPLOYMENT_MODE: 'cloud',
            KOKPIT_PUBLIC_ORIGIN: 'https://kokpit.example/path',
            KOKPIT_ACCESS_PASSWORD: 'a-secure-staging-password-123',
        })).toThrow(/path/);
        expect(() => resolveRuntimeConfig({
            KOKPIT_DEPLOYMENT_MODE: 'cloud',
            KOKPIT_PUBLIC_ORIGIN: 'http://kokpit.example',
            KOKPIT_ACCESS_PASSWORD: 'a-secure-staging-password-123',
        })).toThrow(/https/);
        expect(() => resolveRuntimeConfig({
            KOKPIT_DEPLOYMENT_MODE: 'cloud',
            KOKPIT_PUBLIC_ORIGIN: 'https://kokpit.example',
            KOKPIT_ACCESS_PASSWORD: 'short',
        })).toThrow(/24/);
    });

    it('allows only the declared public/health hosts and public mutation origin in cloud mode', () => {
        const config = cloud({ KOKPIT_TRUSTED_HOSTS: 'preview.example:8443' });
        expect(config.host).toBe('0.0.0.0');
        expect(isTrustedHost('kokpit.example', config)).toBe(true);
        expect(isTrustedHost('healthcheck.railway.app', config)).toBe(true);
        expect(isTrustedHost('preview.example:8443', config)).toBe(true);
        expect(isTrustedHost('attacker.example', config)).toBe(false);
        expect(isTrustedMutationOrigin('https://kokpit.example', config)).toBe(true);
        expect(isTrustedMutationOrigin('https://attacker.example', config)).toBe(false);
    });

    it('requires constant-shape Basic credentials for cloud requests', () => {
        const config = cloud({ KOKPIT_ACCESS_USERNAME: 'reviewer' });
        const good = Buffer.from('reviewer:a-secure-staging-password-123').toString('base64');
        const bad = Buffer.from('reviewer:wrong-password').toString('base64');
        expect(isRequestAuthorized({ authorization: `Basic ${good}` }, config)).toBe(true);
        expect(isRequestAuthorized({ authorization: `Basic ${bad}` }, config)).toBe(false);
        expect(isRequestAuthorized({}, config)).toBe(false);
    });

    it('blocks local-project mutations and arbitrary static source files in cloud mode', () => {
        expect(isCloudLocalRoute('/api/projects/local', 'POST')).toBe(true);
        expect(isCloudLocalRoute('/api/projects/verify/local', 'POST')).toBe(true);
        expect(isCloudLocalRoute('/api/projects/github', 'POST')).toBe(false);
        expect(isCloudStaticPathAllowed('/arayuz-onizleme.html')).toBe(true);
        expect(isCloudStaticPathAllowed('/assets/map-flow.js')).toBe(true);
        expect(isCloudStaticPathAllowed('/PLAN.md')).toBe(false);
        expect(isCloudStaticPathAllowed('/kokpit/server.ts')).toBe(false);
    });
});
