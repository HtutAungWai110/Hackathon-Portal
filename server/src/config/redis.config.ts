import type { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';

const DEFAULT_REDIS_URL = 'redis://localhost:6379';
const DEFAULT_PORT = 6379;

/**
 * BullMQ hands host and port to ioredis, so the one `REDIS_URL` setting is
 * unpacked here instead of asking for five separate variables.
 *
 * `maxRetriesPerRequest: null` is what BullMQ requires for the blocking
 * connection a worker opens. The side effect is that a command issued while
 * Redis is away waits rather than failing, so anything that cannot afford to
 * hang (a signup request) puts its own deadline around the command.
 */
export function readRedisConnection(config: ConfigService): ConnectionOptions {
  const raw = config.get<string>('REDIS_URL')?.trim();
  const url = parseRedisUrl(
    raw === undefined || raw.length === 0 ? DEFAULT_REDIS_URL : raw,
  );
  const database = url.pathname.replace(/^\/+/, '');

  return {
    host: url.hostname,
    port: url.port.length === 0 ? DEFAULT_PORT : Number(url.port),
    ...(url.username.length === 0
      ? {}
      : { username: decodeURIComponent(url.username) }),
    ...(url.password.length === 0
      ? {}
      : { password: decodeURIComponent(url.password) }),
    ...(database.length === 0 ? {} : { db: Number(database) }),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

function parseRedisUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`REDIS_URL is not a valid URL: ${raw}`);
  }

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must start with redis:// or rediss://.');
  }

  const database = url.pathname.replace(/^\/+/, '');
  if (database.length > 0 && !/^\d+$/.test(database)) {
    throw new Error(
      `REDIS_URL has an invalid database name "${database}". Use a number.`,
    );
  }

  return url;
}
