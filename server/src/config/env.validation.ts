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

  return config;
}
