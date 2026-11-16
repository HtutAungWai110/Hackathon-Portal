import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MailService } from '../mail/mail.service.js';
import { AuthMailService } from './auth.mail.js';
import type { AuthMailMessage } from './auth.mail.js';

const MESSAGE: AuthMailMessage = {
  to: 'ada@example.com',
  url: 'http://localhost:5173/login?verified=true&token=abc',
  token: 'abc',
};

async function setUp(enqueue = vi.fn().mockResolvedValue(undefined)) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthMailService,
      { provide: MailService, useValue: { enqueue } },
    ],
  }).compile();

  return { service: moduleRef.get(AuthMailService), enqueue };
}

describe('AuthMailService', () => {
  it('queues a verification job', async () => {
    const { service, enqueue } = await setUp();

    await service.sendVerificationEmail(MESSAGE);

    expect(enqueue).toHaveBeenCalledWith({
      kind: 'verification',
      to: MESSAGE.to,
      url: MESSAGE.url,
    });
  });

  it('queues a reset job', async () => {
    const { service, enqueue } = await setUp();

    await service.sendResetPassword(MESSAGE);

    expect(enqueue).toHaveBeenCalledWith({
      kind: 'password-reset',
      to: MESSAGE.to,
      url: MESSAGE.url,
    });
  });

  it('does not fail an account that was already created', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const { service } = await setUp(
        vi.fn().mockRejectedValue(new Error('redis is away')),
      );

      await expect(
        service.sendVerificationEmail(MESSAGE),
      ).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('Could not queue verification mail for ada@example.com'),
      );
    } finally {
      error.mockRestore();
    }
  });
});
