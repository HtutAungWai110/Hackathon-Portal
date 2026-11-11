/**
 * Base URL of the NestJS API. Both the Better Auth client and the token-aware
 * fetch layer read it here so there is one place to change.
 */
const configuredUrl: string | undefined = import.meta.env.VITE_API_URL;

export const API_URL = (configuredUrl ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
