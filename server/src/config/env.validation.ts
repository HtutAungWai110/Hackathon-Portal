const REQUIRED_KEYS = [
  'ARCJET_KEY',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

const SECRET_KEYS = [
  'BETTER_AUTH_SECRET',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

const MIN_SECRET_LENGTH = 32;

function optional(config: Record<string, unknown>, key: string): string | null {
  const value = config[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Fails bootstrap with a clear message instead of letting a missing secret
 * surface as a confusing runtime error on the first request.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of REQUIRED_KEYS) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(
        `Missing required environment variable: ${key}. Add it to your .env file.`,
      );
    }
  }

  for (const key of SECRET_KEYS) {
    if (String(config[key]).length < MIN_SECRET_LENGTH) {
      throw new Error(`${key} must be at least ${MIN_SECRET_LENGTH} characters.`);
    }
  }

  validateMail(config);
  validateRedis(config);

  return config;
}

/**
 * SMTP is optional: without credentials mail is logged rather than sent, which
 * is how local development works. The pair is all or nothing, though, because
 * `APP_PASSWORD` authenticates as `ADMIN_EMAIL`; refusing half a mailbox is
 * better than a login failure on the first real signup.
 */
function validateMail(config: Record<string, unknown>): void {
  if (optional(config, 'APP_PASSWORD') !== null && optional(config, 'ADMIN_EMAIL') === null) {
    throw new Error(
      'APP_PASSWORD is set but ADMIN_EMAIL is not. APP_PASSWORD signs in as ADMIN_EMAIL, so both are required.',
    );
  }

  const port = optional(config, 'SMTP_PORT');
  if (port !== null) {
    const value = Number(port);
    if (!Number.isInteger(value) || value < 1 || value > 65_535) {
      throw new Error('SMTP_PORT must be a whole number between 1 and 65535.');
    }
  }

  const secure = optional(config, 'SMTP_SECURE');
  if (
    secure !== null &&
    !['true', 'false', '1', '0'].includes(secure.toLowerCase())
  ) {
    throw new Error('SMTP_SECURE must be true or false.');
  }
}

/**
 * The queue's address is checked here so a typo fails at startup rather than
 * on the first signup, when the request would already be half done.
 */
function validateRedis(config: Record<string, unknown>): void {
  const raw = optional(config, 'REDIS_URL');
  if (raw === null) {
    return;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`REDIS_URL is not a valid URL: ${raw}`);
  }

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must start with redis:// or rediss://.');
  }

  const database = url.pathname.replace(/^\/+/, '');
  if (database.length > 0 && !/^\d+$/.test(database)) {
    throw new Error(
      `REDIS_URL has an invalid database name "${database}". Use a number.`,
    );
  }
}
