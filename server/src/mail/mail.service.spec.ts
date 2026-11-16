import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { MAIL_QUEUE } from './mail.constants.js';
import { MailService } from './mail.service.js';
import type { MailJobData } from './mail.types.js';

const JOB: MailJobData = {
  kind: 'verification',
  to: 'ada@example.com',
  url: 'http://localhost:5173/login?verified=true&token=abc',
};

async function setUp(add = vi.fn().mockResolvedValue({ id: '1' })) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      MailService,
      { provide: getQueueToken(MAIL_QUEUE), useValue: { add } },
    ],
  }).compile();

  return { service: moduleRef.get(MailService), add };
}

describe('MailService', () => {
  it('stores the job under the kind that will be rendered', async () => {
    const { service, add } = await setUp();

    await service.enqueue(JOB);

    expect(add).toHaveBeenCalledWith('verification', JOB);
  });

  it('reports a queue failure with the recipient, not a bare driver error', async () => {
    const { service } = await setUp(
      vi.fn().mockRejectedValue(new Error('connection refused')),
    );

    await expect(service.enqueue(JOB)).rejects.toThrow(
      'Could not queue verification mail for ada@example.com: connection refused',
    );
  });

  it('gives up after the deadline when Redis never answers', async () => {
    vi.useFakeTimers();
    try {
      const { service } = await setUp(vi.fn().mockReturnValue(new Promise(() => {})));
      const queued = service.enqueue(JOB);
      const assertion = expect(queued).rejects.toThrow(
        'No response from the mail queue in 5000ms.',
      );

      await vi.advanceTimersByTimeAsync(5_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
