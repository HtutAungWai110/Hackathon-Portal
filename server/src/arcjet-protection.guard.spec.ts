import { ForbiddenException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ARCJET } from '@arcjet/nest';
import type { Request } from 'express';
import { ArcjetProtectionGuard } from './arcjet-protection.guard.js';

const response = { setHeader: vi.fn() };

const context = {
  switchToHttp: () => ({
    getRequest: () => ({}) as Request,
    getResponse: () => response,
  }),
} as ExecutionContext;

function allowedDecision() {
  return {
    isErrored: () => false,
    isDenied: () => false,
    ip: { isHosting: () => false },
    results: [],
  };
}

describe('ArcjetProtectionGuard', () => {
  let guard: ArcjetProtectionGuard;
  let arcjet: { protect: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    arcjet = { protect: vi.fn().mockResolvedValue(allowedDecision()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ArcjetProtectionGuard, { provide: ARCJET, useValue: arcjet }],
    }).compile();

    guard = module.get<ArcjetProtectionGuard>(ArcjetProtectionGuard);
  });

  it('allows a clean request', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(arcjet.protect).toHaveBeenCalledWith({});
  });

  it('throws 429 when the rate limit denies the request', async () => {
    arcjet.protect.mockResolvedValue({
      ...allowedDecision(),
      isDenied: () => true,
      reason: { isRateLimit: () => true, isBot: () => false },
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: { code: 'ARCJET_RATE_LIMIT' },
    });
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('throws 403 when a bot is denied', async () => {
    arcjet.protect.mockResolvedValue({
      ...allowedDecision(),
      isDenied: () => true,
      reason: { isRateLimit: () => false, isBot: () => true },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('fails open when Arcjet errors', async () => {
    arcjet.protect.mockResolvedValue({
      ...allowedDecision(),
      isErrored: () => true,
      reason: { message: 'boom' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks requests from hosting IPs', async () => {
    arcjet.protect.mockResolvedValue({
      ...allowedDecision(),
      ip: { isHosting: () => true },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
