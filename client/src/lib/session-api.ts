import {
  apiFetch,
  ApiError,
  hasAccessCookie,
  refreshSession,
} from './api-client';

/**
 * The user fields this API returns. It mirrors `SessionResponse` in
 * `server/src/auth/session/session-response.ts`; change both together.
 */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  user: AuthUser;
  session: {
    expiresAt: string;
  };
};

async function viaAccessToken(): Promise<AuthSession | null> {
  try {
    return await apiFetch<AuthSession>('/session');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

/**
 * Trades the Better Auth session cookie for this API's tokens. It is how a
 * first load after the Google callback gets a token pair, and the fallback
 * after a password sign in.
 */
async function viaExchange(): Promise<AuthSession | null> {
  try {
    return await apiFetch<AuthSession>('/session/exchange', {
      method: 'POST',
      auth: 'none',
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads the session with the cheapest working credential. The query cache is
 * the authority on the client; this function only has to answer "who is signed
 * in" without assuming which of the two cookies survived.
 */
export async function fetchSession(): Promise<AuthSession | null> {
  if (hasAccessCookie()) {
    const session = await viaAccessToken();
    if (session !== null) {
      return session;
    }
    // The token was rejected and a refresh did not produce a usable one.
    return viaExchange();
  }

  // No access cookie: a fresh sign in or Google callback leaves only the
  // Better Auth cookie, so the exchange is the first try.
  const exchanged = await viaExchange();
  if (exchanged !== null) {
    return exchanged;
  }

  // An access cookie can expire minutes before the refresh cookie does.
  if (await refreshSession()) {
    return viaAccessToken();
  }

  return null;
}

/** Mints a token pair after Better Auth has just confirmed a sign in. */
export async function exchangeSession(): Promise<AuthSession> {
  return apiFetch<AuthSession>('/session/exchange', {
    method: 'POST',
    auth: 'none',
  });
}

/** Ends both the Better Auth session and this API's tokens. */
export async function logoutSession(): Promise<void> {
  await apiFetch<unknown>('/session/logout', {
    method: 'POST',
    auth: 'none',
  });
}
