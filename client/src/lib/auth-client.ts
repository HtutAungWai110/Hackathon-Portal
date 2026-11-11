import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';
import { API_URL } from './api-config';

/**
 * Better Auth handles identity: password sign in and sign up, Google, email
 * verification. It lives at `/auth` on the API. Its session cookie is what
 * `/session/exchange` trades for this app's short lived tokens.
 *
 * Every request carries credentials, because that cookie is set by a
 * different origin than the SPA.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/auth',
  fetchOptions: { credentials: 'include' },
  // Brings `user.role` into the inferred types. The admin methods stay unused
  // here; the server is the one that enforces roles.
  plugins: [adminClient()],
});
