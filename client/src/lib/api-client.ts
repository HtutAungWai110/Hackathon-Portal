import { API_URL } from './api-config';

const ACCESS_TOKEN_COOKIE = 'access_token';
/** A token this close to expiry is treated as gone, to absorb clock skew. */
const EXPIRY_SKEW_MS = 5_000;

/**
 * One error shape for every API call. `status` is 0 when the request never
 * reached the server, which is a different problem from a 401 and should not
 * be reported as "your session ended".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type ApiRequestInit = RequestInit & {
  /**
   * `bearer` attaches the access token and refreshes once on a 401.
   * `none` is for the routes that mint, rotate, or clear tokens: they use the
   * httpOnly cookies and must not trigger a refresh loop.
   */
  auth?: 'bearer' | 'none';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) {
      return decodeURIComponent(entry.slice(prefix.length));
    }
  }
  return null;
}

/**
 * Reads `exp` out of a JWT without verifying it. The server is the authority;
 * this only avoids sending a token that is certainly dead.
 */
function tokenExpiry(token: string): number | null {
  const segment = token.split('.')[1];
  if (segment === undefined) {
    return null;
  }

  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      '=',
    );
    const payload: unknown = JSON.parse(atob(padded));
    if (isRecord(payload) && typeof payload.exp === 'number') {
      return payload.exp;
    }
    return null;
  } catch {
    return null;
  }
}

/** The access token to send, or null when the cookie is missing or stale. */
export function currentAccessToken(): string | null {
  const token = readCookie(ACCESS_TOKEN_COOKIE);
  if (token === null) {
    return null;
  }
  const expiry = tokenExpiry(token);
  if (expiry !== null && expiry * 1000 <= Date.now() + EXPIRY_SKEW_MS) {
    return null;
  }
  return token;
}

/** Whether an access cookie exists at all, expired or not. */
export function hasAccessCookie(): boolean {
  return readCookie(ACCESS_TOKEN_COOKIE) !== null;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Asks the API to rotate the pair. The refresh token is httpOnly, so the
 * browser attaches it and the response replaces both cookies. Concurrent
 * callers share one request instead of racing each other.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_URL}/session/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

function toApiError(status: number, body: unknown): ApiError {
  if (!isRecord(body)) {
    return new ApiError(
      status === 0
        ? 'Cannot reach the server. Check that the API is running.'
        : 'Something went wrong. Try again.',
      status,
      null,
    );
  }

  const code = typeof body.code === 'string' ? body.code : null;
  const fromMessage = Array.isArray(body.message)
    ? body.message.find((entry): entry is string => typeof entry === 'string')
    : typeof body.message === 'string'
      ? body.message
      : null;
  const fromError = typeof body.error === 'string' ? body.error : null;

  return new ApiError(
    fromMessage ??
      fromError ??
      (status === 0
        ? 'Cannot reach the server. Check that the API is running.'
        : 'Something went wrong. Try again.'),
    status,
    code,
  );
}

async function send(
  path: string,
  init: RequestInit,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token !== null) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      'Cannot reach the server. Check that the API is running.',
      0,
      null,
    );
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw toApiError(response.status, body);
  }

  // The single untyped boundary: every caller declares the shape it expects
  // from a route this repository owns.
  return body as T;
}

/**
 * The only way the SPA calls the API. It attaches the bearer token, retries
 * exactly once after a refresh, and normalizes failures into `ApiError`.
 */
export async function apiFetch<T>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const { auth = 'bearer', ...request } = init;

  if (auth === 'none') {
    return parse<T>(await send(path, request, null));
  }

  let attemptedRefresh = false;
  let token = currentAccessToken();

  if (token === null) {
    attemptedRefresh = true;
    if (await refreshSession()) {
      token = currentAccessToken();
    }
  }

  let response = await send(path, request, token);

  if (response.status === 401 && !attemptedRefresh) {
    if (await refreshSession()) {
      response = await send(path, request, currentAccessToken());
    }
  }

  return parse<T>(response);
}
