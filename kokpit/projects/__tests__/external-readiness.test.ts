import { describe, expect, it } from 'vitest';
import { githubAuthConfiguration } from '../github';

type AuthEnvKey =
    | 'GITHUB_APP_ID'
    | 'GITHUB_APP_INSTALLATION_ID'
    | 'GITHUB_APP_PRIVATE_KEY'
    | 'GITHUB_APP_PRIVATE_KEY_PATH'
    | 'GITHUB_TOKEN';

const AUTH_ENV_KEYS: readonly AuthEnvKey[] = [
    'GITHUB_APP_ID',
    'GITHUB_APP_INSTALLATION_ID',
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_APP_PRIVATE_KEY_PATH',
    'GITHUB_TOKEN',
];

const NON_SECRET_PLACEHOLDERS: Readonly<Record<'GITHUB_APP_ID' | 'GITHUB_APP_INSTALLATION_ID', string>> = {
    GITHUB_APP_ID: 'kokpit-probe-app-id-not-real',
    GITHUB_APP_INSTALLATION_ID: 'kokpit-probe-installation-id-not-real',
};

const UNREACHABLE_KEY_PATH = '/tmp/opencode/kokpit-readiness-absent.pem';

const AMBIENT_PRESENCE_AT_LOAD: Readonly<Record<AuthEnvKey, boolean>> = Object.fromEntries(
    AUTH_ENV_KEYS.map((key) => [key, Boolean(process.env[key]?.trim())]),
) as Readonly<Record<AuthEnvKey, boolean>>;

interface EnvGuard {
    set: (key: AuthEnvKey, value: string) => void;
    clearAll: () => void;
    restore: () => void;
}

function captureAuthEnv(): EnvGuard {
    const snapshot = AUTH_ENV_KEYS.map((key) => [key, process.env[key]] as const);
    return {
        set(key, value) {
            process.env[key] = value;
        },
        clearAll() {
            for (const key of AUTH_ENV_KEYS) delete process.env[key];
        },
        restore() {
            for (const [key, value] of snapshot) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
        },
    };
}

describe('external readiness — GitHub kimlik yapılandırması', () => {
    it('ortam durumu yalnız boolean olarak raporlanır; ham değerler hiçbir yerde okunmaz/beklenmez', () => {
        const presence: Record<AuthEnvKey, boolean> = {
            GITHUB_APP_ID: Boolean(process.env.GITHUB_APP_ID?.trim()),
            GITHUB_APP_INSTALLATION_ID: Boolean(process.env.GITHUB_APP_INSTALLATION_ID?.trim()),
            GITHUB_APP_PRIVATE_KEY: Boolean(process.env.GITHUB_APP_PRIVATE_KEY?.trim()),
            GITHUB_APP_PRIVATE_KEY_PATH: Boolean(process.env.GITHUB_APP_PRIVATE_KEY_PATH?.trim()),
            GITHUB_TOKEN: Boolean(process.env.GITHUB_TOKEN?.trim()),
        };
        for (const key of AUTH_ENV_KEYS) {
            expect(typeof presence[key]).toBe('boolean');
            expect(presence[key]).toBe(AMBIENT_PRESENCE_AT_LOAD[key]);
        }
        expect(Object.values(presence).every((value) => typeof value === 'boolean')).toBe(true);
    });

    it('GitHub App üçlüsü eksikken configured:false döner', () => {
        const guard = captureAuthEnv();
        try {
            guard.clearAll();
            guard.set('GITHUB_APP_ID', NON_SECRET_PLACEHOLDERS.GITHUB_APP_ID);
            guard.set('GITHUB_APP_INSTALLATION_ID', NON_SECRET_PLACEHOLDERS.GITHUB_APP_INSTALLATION_ID);

            expect(githubAuthConfiguration()).toEqual({ mode: 'anonymous-public-only', configured: false });
        } finally {
            guard.restore();
        }
    });

    it('üçlüden en az biri eksikken yanıt asla github-app moduna ulaşmaz', () => {
        const guard = captureAuthEnv();
        try {
            guard.clearAll();
            guard.set('GITHUB_APP_ID', NON_SECRET_PLACEHOLDERS.GITHUB_APP_ID);
            guard.set('GITHUB_APP_INSTALLATION_ID', NON_SECRET_PLACEHOLDERS.GITHUB_APP_INSTALLATION_ID);
            guard.set('GITHUB_APP_PRIVATE_KEY_PATH', UNREACHABLE_KEY_PATH);

            expect(githubAuthConfiguration().mode).not.toBe('github-app');

            guard.clearAll();
            guard.set('GITHUB_APP_ID', '');
            guard.set('GITHUB_APP_INSTALLATION_ID', NON_SECRET_PLACEHOLDERS.GITHUB_APP_INSTALLATION_ID);
            guard.set('GITHUB_APP_PRIVATE_KEY', 'kokpit-probe-inline-key-not-a-real-pem');

            const blankIdResult = githubAuthConfiguration();
            expect(blankIdResult.mode).not.toBe('github-app');
            expect(blankIdResult.configured).toBe(false);

            guard.clearAll();
            guard.set('GITHUB_APP_ID', NON_SECRET_PLACEHOLDERS.GITHUB_APP_ID);
            guard.set('GITHUB_APP_PRIVATE_KEY_PATH', UNREACHABLE_KEY_PATH);

            const missingInstallation = githubAuthConfiguration();
            expect(missingInstallation.mode).not.toBe('github-app');
            expect(missingInstallation.configured).toBe(false);

            guard.clearAll();
            guard.set('GITHUB_TOKEN', 'kokpit-probe-server-token-placeholder');
            guard.set('GITHUB_APP_INSTALLATION_ID', NON_SECRET_PLACEHOLDERS.GITHUB_APP_INSTALLATION_ID);

            const partialWithServerToken = githubAuthConfiguration();
            expect(partialWithServerToken.mode).toBe('server-token');
            expect(partialWithServerToken.configured).toBe(true);
        } finally {
            guard.restore();
        }
    });

    it('üçlü tamamen doluyken (geçersiz/gerçek olmayan anahtarla bile) kapı tam olarak o zaman açılır', () => {
        const guard = captureAuthEnv();
        try {
            guard.clearAll();
            guard.set('GITHUB_APP_ID', NON_SECRET_PLACEHOLDERS.GITHUB_APP_ID);
            guard.set('GITHUB_APP_INSTALLATION_ID', NON_SECRET_PLACEHOLDERS.GITHUB_APP_INSTALLATION_ID);
            guard.set('GITHUB_APP_PRIVATE_KEY', 'kokpit-probe-inline-key-not-a-real-pem');

            expect(githubAuthConfiguration()).toEqual({ mode: 'github-app', configured: true });
        } finally {
            guard.restore();
        }
    });

    it('her mutasyon sonrası ortam, yüklenme anındaki VAR/YOK durumuna birebir döner', () => {
        const guard = captureAuthEnv();
        try {
            guard.clearAll();
            guard.set('GITHUB_APP_ID', NON_SECRET_PLACEHOLDERS.GITHUB_APP_ID);
            guard.set('GITHUB_TOKEN', 'kokpit-probe-server-token-placeholder');
            expect(Boolean(process.env.GITHUB_APP_ID)).toBe(true);
            expect(Boolean(process.env.GITHUB_TOKEN)).toBe(true);
        } finally {
            guard.restore();
        }

        for (const key of AUTH_ENV_KEYS) {
            expect(Boolean(process.env[key]?.trim())).toBe(AMBIENT_PRESENCE_AT_LOAD[key]);
        }
    });
});
