import { ApiError } from './api-client';

/**
 * Two error shapes reach the auth screens: `ApiError` from the API client (this
 * app's own routes) and the object Better Auth returns instead of throwing,
 * where the useful part is nested under `error.error`. This turns either into
 * one typed error with copy a person can act on.
 */
export class AuthRequestError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'AuthRequestError';
    this.status = status;
    this.code = code;
  }
}

const MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED:
    'Verify your email before signing in. The link is in your inbox.',
  INVALID_EMAIL_OR_PASSWORD: 'That email and password do not match.',
  USER_ALREADY_EXISTS:
    'An account with that email already exists. Sign in instead.',
  PASSWORD_TOO_SHORT: 'Use at least 8 characters for your password.',
  PASSWORD_TOO_LONG: 'Use 128 characters or fewer for your password.',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVALID_PASSWORD: 'Enter your password.',
  TOO_MANY_REQUESTS: 'Too many attempts. Wait a minute, then try again.',
  SESSION_EXPIRED: 'Your session ended. Sign in again.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toAuthError(error: unknown): AuthRequestError {
  if (error instanceof AuthRequestError) {
    return error;
  }

  // The API client already normalized the server's message and status.
  if (error instanceof ApiError) {
    return new AuthRequestError(
      (error.code !== null ? MESSAGES[error.code] : undefined) ?? error.message,
      error.status,
      error.code,
    );
  }

  const status =
    isRecord(error) && typeof error.status === 'number' ? error.status : 0;
  const body = isRecord(error) && isRecord(error.error) ? error.error : null;
  const code = body !== null && typeof body.code === 'string' ? body.code : null;
  const serverMessage =
    body !== null && typeof body.message === 'string' ? body.message : null;

  const fallback =
    status === 0
      ? 'Cannot reach the server. Check that the API is running, then try again.'
      : 'Something went wrong. Try again.';

  return new AuthRequestError(
    (code !== null ? MESSAGES[code] : undefined) ?? serverMessage ?? fallback,
    status,
    code,
  );
}

export function authErrorMessage(error: unknown): string {
  return toAuthError(error).message;
}
