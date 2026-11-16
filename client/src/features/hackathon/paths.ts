export const HACKATHON_PATH = '/hackathon';

/**
 * The public detail page's address. The id travels as a query parameter rather
 * than a path segment, so the page can render its own "no event selected"
 * state instead of the router falling through to a 404.
 */
export function hackathonPath(id: string): string {
  return `${HACKATHON_PATH}?id=${encodeURIComponent(id)}`;
}
