import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['kokpit/**/*.test.ts'],
        environment: 'node',
    },
});
