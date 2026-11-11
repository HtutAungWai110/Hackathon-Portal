import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ACCESS_COOKIE_PATH,
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
} from './session.constants.js';
import { SessionService } from './session.service.js';

const ACCESS_SECRET = 'a'.repeat(64);
const REFRESH_SECRET = 'b'.repeat(64);

const config = {
  getOrThrow: (key: string): string => {
    if (key === 'JWT_ACCESS_SECRET') {
      return ACCESS_SECRET;
    }
    if (key === 'JWT_REFRESH_SECRET') {
      return REFRESH_SECRET;
    }
    throw new Error(`Unexpected key ${key}`);
  },
  get: (): string | undefined => undefined,
};

const user = { id: 'user_1', role: 'participant' };

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionService, { provide: ConfigService, useValue: config }],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('issues a verifiable access token and refresh token', async () => {
    const pair = await service.issue(user);

    await expect(service.verifyAccess(pair.accessToken)).resolves.toMatchObject({
      userId: 'user_1',
      role: 'participant',
    });
    await expect(
      service.verifyRefresh(pair.refreshToken),
    ).resolves.toMatchObject({ userId: 'user_1' });
  });

  it('does not accept a refresh token as a bearer credential', async () => {
    const pair = await service.issue(user);

    await expect(service.verifyAccess(pair.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      service.verifyRefresh(pair.accessToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an access token after its fifteen minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const pair = await service.issue(user);

    vi.setSystemTime(new Date('2026-01-01T00:15:01Z'));

    await expect(service.verifyAccess(pair.accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('keeps the refresh token valid for seven days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const pair = await service.issue(user);

    vi.setSystemTime(new Date('2026-01-07T23:59:00Z'));

    await expect(
      service.verifyRefresh(pair.refreshToken),
    ).resolves.toMatchObject({ userId: 'user_1' });
  });

  it('rejects a token signed with another key', async () => {
    const pair = await service.issue(user);

    await expect(
      service.verifyAccess(`${pair.accessToken}x`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('writes a script readable access cookie and an httpOnly refresh cookie', async () => {
    const pair = await service.issue(user);
    const cookie = vi.fn();
    const clearCookie = vi.fn();

    service.writeCookies({ cookie, clearCookie }, pair);

    expect(cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      pair.accessToken,
      expect.objectContaining({
        httpOnly: false,
        path: ACCESS_COOKIE_PATH,
      }),
    );
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      pair.refreshToken,
      expect.objectContaining({
        httpOnly: true,
        path: REFRESH_COOKIE_PATH,
      }),
    );
  });

  it('clears both cookies on the paths they were set on', async () => {
    const cookie = vi.fn();
    const clearCookie = vi.fn();

    service.clearCookies({ cookie, clearCookie });

    expect(clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.objectContaining({ path: ACCESS_COOKIE_PATH }),
    );
    expect(clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ path: REFRESH_COOKIE_PATH }),
    );
  });
});
