const DEFAULT_CLIENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5137',
];

/**
 * The browser origins allowed to talk to this API, for both HTTP and the
 * websocket. Both read one function: a new origin has to land here to work
 * anywhere, and editing two copies is how it silently half-works.
 */
export function clientOrigins(): string[] {
  const configured = process.env.CLIENT_URL;
  if (configured === undefined) {
    return DEFAULT_CLIENT_ORIGINS;
  }
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : DEFAULT_CLIENT_ORIGINS;
}
