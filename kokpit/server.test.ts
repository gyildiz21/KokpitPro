import { describe, expect, it } from 'vitest';
import { GithubVerificationError } from './projects/github';
import { githubVerificationHttpStatus, isAllowedHostHeader, isStaticPathBlocked } from './server';

describe('local server security boundaries', () => {
    it('blocks secret, registry, dependency, and reference-engine paths', () => {
        for (const path of [
            '/.env',
            '/.env.local',
            '/nested/.env.production',
            '/.git/config',
            '/.kokpit/data/projects.json',
            '/node_modules/zod/index.js',
            '/gitdiagram',
            '/gitdiagram/.env',
        ]) {
            expect(isStaticPathBlocked(path), path).toBe(true);
        }
        expect(isStaticPathBlocked('/arayuz-onizleme.html')).toBe(false);
        expect(isStaticPathBlocked('/docs/environment.md')).toBe(false);
    });

    it('accepts only the configured local host aliases and exact port', () => {
        expect(isAllowedHostHeader('127.0.0.1:4173')).toBe(true);
        expect(isAllowedHostHeader('LOCALHOST:4173')).toBe(true);
        expect(isAllowedHostHeader('0.0.0.0:4173', '0.0.0.0', 4173)).toBe(true);
        expect(isAllowedHostHeader('attacker.example:4173')).toBe(false);
        expect(isAllowedHostHeader('localhost:4174')).toBe(false);
        expect(isAllowedHostHeader(undefined)).toBe(false);
    });

    it('maps GitHub network failures to a valid gateway status and preserves valid upstream classes', () => {
        expect(githubVerificationHttpStatus(new GithubVerificationError(0, 'network', 'offline'))).toBe(502);
        expect(githubVerificationHttpStatus(new GithubVerificationError(404, 'not-found-or-private', 'missing'))).toBe(404);
        expect(githubVerificationHttpStatus(new GithubVerificationError(429, 'rate-limit', 'later', '60'))).toBe(429);
    });
});
