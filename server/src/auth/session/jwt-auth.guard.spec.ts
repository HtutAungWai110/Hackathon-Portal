import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedRequest } from './request.types.js';
import { SessionService } from './session.service.js';

const record = {
  id: 'user_1',
  name: 'Ada',
  email: 'ada@example.com',
  emailVerified: true,
  image: null,
  role: 'participant',
  banned: false,
  banExpires: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function makeContext(request: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request as Request,
      getResponse: () => ({}),
    }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let sessions: { verifyAccess: ReturnType<typeof vi.fn> };
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };
  let metadata: Record<string, unknown>;

  beforeEach(async () => {
    sessions = { verifyAccess: vi.fn() };
    prisma = { user: { findUnique: vi.fn() } };
    metadata = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: SessionService, useValue: sessions },
        { provide: PrismaService, useValue: prisma },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: (key: string) => metadata[key],
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('rejects a request without a bearer token', async () => {
    const request = { headers: {} } as AuthenticatedRequest;

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the user loaded from the database', async () => {
    sessions.verifyAccess.mockResolvedValue({
      userId: 'user_1',
      role: 'participant',
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValue(record);
    const request = {
      headers: { authorization: 'Bearer good-token' },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'user_1', role: 'participant' });
    expect(request.session?.session.expiresAt).toBeInstanceOf(Date);
  });

  it('lets an anonymous caller through a public route', async () => {
    metadata['PUBLIC'] = true;
    const request = { headers: {} } as AuthenticatedRequest;

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.user).toBeNull();
  });

  it('treats an expired token as anonymous on a public route', async () => {
    metadata['PUBLIC'] = true;
    sessions.verifyAccess.mockRejectedValue(new UnauthorizedException());
    const request = {
      headers: { authorization: 'Bearer expired' },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
  });

  it('rejects a user whose role is not allowed', async () => {
    metadata['ROLES'] = ['admin'];
    sessions.verifyAccess.mockResolvedValue({
      userId: 'user_1',
      role: 'participant',
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValue(record);
    const request = {
      headers: { authorization: 'Bearer good-token' },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a suspended account', async () => {
    sessions.verifyAccess.mockResolvedValue({
      userId: 'user_1',
      role: 'participant',
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValue({
      ...record,
      banned: true,
      banExpires: null,
    });
    const request = {
      headers: { authorization: 'Bearer good-token' },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a token whose account is gone', async () => {
    sessions.verifyAccess.mockResolvedValue({
      userId: 'user_1',
      role: 'participant',
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValue(null);
    const request = {
      headers: { authorization: 'Bearer good-token' },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
