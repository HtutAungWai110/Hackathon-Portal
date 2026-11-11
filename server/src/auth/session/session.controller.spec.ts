import { ForbiddenException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import request from 'supertest';
import { AdminController } from '../../admin/admin.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './session.constants.js';
import { SessionController } from './session.controller.js';
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

function userRecord(overrides: { role?: string; banned?: boolean } = {}) {
  return {
    id: 'user_1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    emailVerified: true,
    image: null,
    role: overrides.role ?? 'participant',
    banned: overrides.banned ?? false,
    banExpires: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

/** supertest reports `set-cookie` as an array at runtime, a string in its types. */
function setCookies(response: { headers: Record<string, unknown> }): string[] {
  const header = response.headers['set-cookie'];
  if (Array.isArray(header)) {
    return header.filter((entry): entry is string => typeof entry === 'string');
  }
  return typeof header === 'string' ? [header] : [];
}

function cookieValue(
  response: { headers: Record<string, unknown> },
  name: string,
): string | null {
  for (const raw of setCookies(response)) {
    const pair = raw.split(';')[0] ?? '';
    const separator = pair.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (pair.slice(0, separator).trim() === name) {
      return decodeURIComponent(pair.slice(separator + 1));
    }
  }
  return null;
}

/** A Set-Cookie that removes the cookie, which has no value and Max-Age=0. */
function clearsCookie(
  response: { headers: Record<string, unknown> },
  name: string,
): boolean {
  return setCookies(response).some(
    (raw) =>
      raw.startsWith(`${name}=`) &&
      (raw.includes('Max-Age=0') || raw.includes('Expires=Thu, 01 Jan 1970')),
  );
}

type AuthMock = {
  api: {
    getSession: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
};

describe('SessionController (HTTP)', () => {
  let app: INestApplication;
  let auth: AuthMock;
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    auth = {
      api: {
        getSession: vi.fn().mockResolvedValue(null),
        signOut: vi.fn().mockResolvedValue({
          headers: {
            getSetCookie: () => [
              'better-auth.session_token=; Max-Age=0; Path=/; HttpOnly',
            ],
          },
        }),
      },
    };
    prisma = { user: { findUnique: vi.fn().mockResolvedValue(userRecord()) } };

    const moduleRef = await Test.createTestingModule({
      // AdminController is here only so the guard's @Roles path is exercised
      // against a real route.
      controllers: [SessionController, AdminController],
      providers: [
        SessionService,
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function exchange(): Promise<{ access: string; refresh: string }> {
    auth.api.getSession.mockResolvedValue({ user: { id: 'user_1' } });
    const response = await request(app.getHttpServer()).post('/session/exchange');

    const access = cookieValue(response, ACCESS_TOKEN_COOKIE);
    const refresh = cookieValue(response, REFRESH_TOKEN_COOKIE);
    if (access === null || refresh === null) {
      throw new Error('The exchange did not set both cookies.');
    }
    return { access, refresh };
  }

  describe('POST /session/exchange', () => {
    it('trades a Better Auth session for both tokens', async () => {
      auth.api.getSession.mockResolvedValue({ user: { id: 'user_1' } });

      const response = await request(app.getHttpServer()).post('/session/exchange');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        user: { id: 'user_1', email: 'ada@example.com', role: 'participant' },
      });
      expect(typeof response.body.session.expiresAt).toBe('string');
      expect(cookieValue(response, ACCESS_TOKEN_COOKIE)).not.toBeNull();
      expect(cookieValue(response, REFRESH_TOKEN_COOKIE)).not.toBeNull();
    });

    it('keeps the access cookie readable and the refresh cookie httpOnly', async () => {
      auth.api.getSession.mockResolvedValue({ user: { id: 'user_1' } });

      const response = await request(app.getHttpServer()).post('/session/exchange');
      const [access] = setCookies(response).filter((raw) =>
        raw.startsWith(`${ACCESS_TOKEN_COOKIE}=`),
      );
      const [refresh] = setCookies(response).filter((raw) =>
        raw.startsWith(`${REFRESH_TOKEN_COOKIE}=`),
      );

      expect(access).toBeDefined();
      expect(refresh).toBeDefined();
      expect(access).not.toContain('HttpOnly');
      expect(refresh).toContain('HttpOnly');
      // The refresh cookie is scoped to the routes that need it.
      expect(refresh).toContain('Path=/session');
    });

    it('refuses to mint tokens without a Better Auth session', async () => {
      auth.api.getSession.mockResolvedValue(null);

      const response = await request(app.getHttpServer()).post('/session/exchange');

      expect(response.status).toBe(401);
      expect(setCookies(response)).toHaveLength(0);
    });

    it('never returns a token in the response body', async () => {
      auth.api.getSession.mockResolvedValue({ user: { id: 'user_1' } });

      const response = await request(app.getHttpServer()).post('/session/exchange');

      expect(Object.keys(response.body).sort()).toEqual(['session', 'user']);
      expect(JSON.stringify(response.body)).not.toContain('eyJ');
    });
  });

  describe('GET /session', () => {
    it('returns the signed in user for a bearer access token', async () => {
      const { access } = await exchange();

      const response = await request(app.getHttpServer())
        .get('/session')
        .set('Authorization', `Bearer ${access}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: 'user_1',
        name: 'Ada Lovelace',
      });
    });

    it('rejects an anonymous request', async () => {
      const response = await request(app.getHttpServer()).get('/session');

      expect(response.status).toBe(401);
    });

    it('does not accept a refresh token as a bearer token', async () => {
      const { refresh } = await exchange();

      const response = await request(app.getHttpServer())
        .get('/session')
        .set('Authorization', `Bearer ${refresh}`);

      expect(response.status).toBe(401);
    });

    it('reports the refresh token expiry, not the access expiry', async () => {
      const { access, refresh } = await exchange();

      const response = await request(app.getHttpServer())
        .get('/session')
        .set('Authorization', `Bearer ${access}`)
        .set(
          'Cookie',
          `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(refresh)}`,
        );

      expect(response.status).toBe(200);
      const expiresAt = new Date(response.body.session.expiresAt).getTime();
      // Access tokens are fifteen minutes; a seven day refresh token is later.
      expect(expiresAt - Date.now()).toBeGreaterThan(16 * 60 * 1000);
    });
  });

  describe('POST /session/refresh', () => {
    it('rotates both tokens', async () => {
      const first = await exchange();

      const response = await request(app.getHttpServer())
        .post('/session/refresh')
        .set(
          'Cookie',
          `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(first.refresh)}`,
        );

      expect(response.status).toBe(200);
      expect(cookieValue(response, ACCESS_TOKEN_COOKIE)).not.toBeNull();
      expect(cookieValue(response, REFRESH_TOKEN_COOKIE)).not.toBeNull();
      expect(cookieValue(response, REFRESH_TOKEN_COOKIE)).not.toBe(
        first.refresh,
      );
    });

    it('rejects a request with no refresh cookie', async () => {
      const response = await request(app.getHttpServer()).post('/session/refresh');

      expect(response.status).toBe(401);
    });

    it('clears the cookies when the refresh token is not valid', async () => {
      const response = await request(app.getHttpServer())
        .post('/session/refresh')
        .set('Cookie', `${REFRESH_TOKEN_COOKIE}=not-a-token`);

      expect(response.status).toBe(401);
      expect(clearsCookie(response, ACCESS_TOKEN_COOKIE)).toBe(true);
      expect(clearsCookie(response, REFRESH_TOKEN_COOKIE)).toBe(true);
    });

    it('refuses to refresh an account that no longer exists', async () => {
      const { refresh } = await exchange();
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/session/refresh')
        .set(
          'Cookie',
          `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(refresh)}`,
        );

      expect(response.status).toBe(401);
      expect(clearsCookie(response, REFRESH_TOKEN_COOKIE)).toBe(true);
    });
  });

  describe('POST /session/logout', () => {
    it('ends the Better Auth session and clears both cookies', async () => {
      await exchange();

      const response = await request(app.getHttpServer())
        .post('/session/logout')
        .set('Cookie', 'better-auth.session_token=still-valid');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
      expect(auth.api.signOut).toHaveBeenCalledTimes(1);
      expect(clearsCookie(response, ACCESS_TOKEN_COOKIE)).toBe(true);
      expect(clearsCookie(response, REFRESH_TOKEN_COOKIE)).toBe(true);
    });

    it('still clears the cookies when Better Auth has no session to end', async () => {
      auth.api.signOut.mockRejectedValue(new ForbiddenException());

      const response = await request(app.getHttpServer()).post('/session/logout');

      expect(response.status).toBe(200);
      expect(clearsCookie(response, ACCESS_TOKEN_COOKIE)).toBe(true);
      expect(clearsCookie(response, REFRESH_TOKEN_COOKIE)).toBe(true);
    });
  });

  describe('role enforcement with the access token', () => {
    it('forbids a participant from an admin route', async () => {
      const { access } = await exchange();

      const response = await request(app.getHttpServer())
        .get('/admin/ping')
        .set('Authorization', `Bearer ${access}`);

      expect(response.status).toBe(403);
    });

    it('allows an admin', async () => {
      const { access } = await exchange();
      prisma.user.findUnique.mockResolvedValue(userRecord({ role: 'admin' }));

      const response = await request(app.getHttpServer())
        .get('/admin/ping')
        .set('Authorization', `Bearer ${access}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
    });

    it('forbids a suspended account even with a valid token', async () => {
      const { access } = await exchange();
      prisma.user.findUnique.mockResolvedValue(userRecord({ banned: true }));

      const response = await request(app.getHttpServer())
        .get('/session')
        .set('Authorization', `Bearer ${access}`);

      expect(response.status).toBe(403);
    });
  });
});
