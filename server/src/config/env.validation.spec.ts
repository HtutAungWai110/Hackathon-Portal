import { validateEnv } from './env.validation.js';

const BASE: Record<string, string> = {
  ARCJET_KEY: 'ajkey_test',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  JWT_ACCESS_SECRET: 'b'.repeat(32),
  JWT_REFRESH_SECRET: 'c'.repeat(32),
};

function withMail(overrides: Record<string, string>) {
  return { ...BASE, ...overrides };
}

describe('validateEnv', () => {
  it('accepts the required keys with no mail configuration', () => {
    expect(() => validateEnv(BASE)).not.toThrow();
  });

  it('accepts a sender address on its own, because the seed reads it', () => {
    expect(() =>
      validateEnv(withMail({ ADMIN_EMAIL: 'admin@example.com' })),
    ).not.toThrow();
  });

  it('refuses a password without the address it signs in as', () => {
    expect(() =>
      validateEnv(withMail({ APP_PASSWORD: 'app-password' })),
    ).toThrow(/ADMIN_EMAIL/);
  });

  it('accepts a complete mailbox', () => {
    expect(() =>
      validateEnv(
        withMail({
          ADMIN_EMAIL: 'admin@example.com',
          APP_PASSWORD: 'app-password',
          SMTP_PORT: '587',
          SMTP_SECURE: 'false',
          REDIS_URL: 'redis://localhost:6379',
        }),
      ),
    ).not.toThrow();
  });

  it('refuses a port that is not a number', () => {
    expect(() => validateEnv(withMail({ SMTP_PORT: 'imap' }))).toThrow(
      /SMTP_PORT/,
    );
  });

  it('refuses a secure flag it cannot interpret', () => {
    expect(() => validateEnv(withMail({ SMTP_SECURE: 'maybe' }))).toThrow(
      /SMTP_SECURE/,
    );
  });

  it('refuses a Redis URL that is not Redis', () => {
    expect(() =>
      validateEnv(withMail({ REDIS_URL: 'postgresql://localhost:5432/db' })),
    ).toThrow(/REDIS_URL/);
  });

  it('accepts a Redis database number', () => {
    expect(() =>
      validateEnv(withMail({ REDIS_URL: 'rediss://user:pass@redis:6380/2' })),
    ).not.toThrow();
  });
});
