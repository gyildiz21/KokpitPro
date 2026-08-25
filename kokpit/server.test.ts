import { describe, expect, it } from 'vitest';
import { isAllowedHostHeader, isStaticPathBlocked } from './server';

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
});
