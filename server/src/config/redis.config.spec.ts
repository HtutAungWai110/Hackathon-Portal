import { ConfigService } from '@nestjs/config';
import { readRedisConnection } from './redis.config.js';

function read(values: Record<string, string> = {}) {
  return readRedisConnection(new ConfigService(values));
}

describe('readRedisConnection', () => {
  it('defaults to a local Redis', () => {
    expect(read()).toMatchObject({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    });
  });

  it('unpacks a URL with credentials and a database', () => {
    expect(read({ REDIS_URL: 'redis://ada:secret@cache:6380/3' })).toMatchObject({
      host: 'cache',
      port: 6380,
      username: 'ada',
      password: 'secret',
      db: 3,
    });
  });

  it('turns on TLS for rediss', () => {
    expect(read({ REDIS_URL: 'rediss://cache:6379' }).tls).toEqual({});
  });

  it('refuses a URL that is not Redis', () => {
    expect(() => read({ REDIS_URL: 'http://localhost:6379' })).toThrow(
      /REDIS_URL/,
    );
  });

  it('refuses a database that is not a number', () => {
    expect(() => read({ REDIS_URL: 'redis://localhost:6379/mail' })).toThrow(
      /database/,
    );
  });
});
