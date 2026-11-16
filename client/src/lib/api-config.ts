/**
 * Base URL of the NestJS API. Both the Better Auth client and the token-aware
 * fetch layer read it here so there is one place to change.
 */
const configuredUrl: string | undefined = import.meta.env.VITE_API_URL;

export const API_URL = (configuredUrl ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

/**
 * An absolute URL for a path this API serves, such as an uploaded event image.
 * Already absolute URLs pass through, so a seeded value or a CDN link works
 * without being rewritten.
 */
export function apiAssetUrl(path: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(path)) {
    return path;
  }
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
