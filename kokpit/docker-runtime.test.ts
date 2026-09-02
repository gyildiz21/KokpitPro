import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('Railway volume runtime boundary', () => {
    it('repairs the mounted data directory as root, then drops to the node user', () => {
        const dockerfile = readFileSync(resolve(root, 'Dockerfile'), 'utf8');
        const entrypoint = readFileSync(resolve(root, 'scripts/docker-entrypoint.sh'), 'utf8');

        expect(dockerfile).toContain('apt-get install -y --no-install-recommends gosu');
        expect(dockerfile).toContain('ENTRYPOINT ["./scripts/docker-entrypoint.sh"]');
        expect(dockerfile).not.toMatch(/^USER node$/mu);
        expect(entrypoint).not.toContain('\r');
        expect(entrypoint).toContain('chown -R node:node "${KOKPIT_DATA_DIR:-/data}"');
        expect(entrypoint).toContain('exec gosu node "$@"');
    });
});
