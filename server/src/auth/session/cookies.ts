/**
 * Reads one cookie out of the `Cookie` request header. The auth handler sets
 * signed, URL-safe values, so splitting on `;` and `=` is enough; no parser
 * dependency is needed for two cookies.
 */
export function readCookie(
  header: string | undefined,
  name: string,
): string | null {
  if (header === undefined) {
    return null;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return null;
}
