import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';
import type { MailSettings } from './mail.config.js';
import { MAIL_SETTINGS } from './mail.constants.js';
import { MailProcessor } from './mail.processor.js';
import type { MailJobData } from './mail.types.js';
import { MAIL_TRANSPORT } from './transports/mail-transport.js';

const SETTINGS: MailSettings = { brand: 'Winter Jam', smtp: null };

const JOB = {
  data: {
    kind: 'password-reset',
    to: 'ada@example.com',
    url: 'http://localhost:5173/login?token=abc',
  } satisfies MailJobData,
} as Job<MailJobData>;

async function setUp(send = vi.fn().mockResolvedValue(undefined)) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      MailProcessor,
      { provide: MAIL_SETTINGS, useValue: SETTINGS },
      { provide: MAIL_TRANSPORT, useValue: { send } },
    ],
  }).compile();

  return { processor: moduleRef.get(MailProcessor), send };
}

describe('MailProcessor', () => {
  it('renders the job with the configured brand and sends it', async () => {
    const { processor, send } = await setUp();

    await processor.process(JOB);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@example.com',
        subject: 'Reset your Winter Jam password',
        url: 'http://localhost:5173/login?token=abc',
      }),
    );
  });

  it('lets a transport failure reject, which is what retries the job', async () => {
    const { processor } = await setUp(
      vi.fn().mockRejectedValue(new Error('smtp is down')),
    );

    await expect(processor.process(JOB)).rejects.toThrow('smtp is down');
  });
});
