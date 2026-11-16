import { Inject, Injectable } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { MAIL_QUEUE } from './mail.constants.js';
import type { MailJobData } from './mail.types.js';

/**
 * How long a caller waits for Redis before giving up. BullMQ keeps the failed
 * command in ioredis' offline queue, so a job attempted while Redis is down
 * is still delivered once it returns; the deadline only stops an auth request
 * from hanging while that happens.
 */
const ENQUEUE_DEADLINE_MS = 5_000;

/**
 * The producer side of the queue. It knows the job shape and nothing about
 * SMTP, which is what lets a signup return as soon as the job is stored.
 *
 * Failures are thrown, not swallowed: whether a missing email should break the
 * caller is a product decision, and `AuthMailService` makes it explicitly.
 */
@Injectable()
export class MailService {
  constructor(
    @Inject(getQueueToken(MAIL_QUEUE))
    private readonly queue: Queue<MailJobData>,
  ) {}

  async enqueue(data: MailJobData): Promise<void> {
    try {
      await withDeadline(
        this.queue.add(data.kind, data),
        ENQUEUE_DEADLINE_MS,
      );
    } catch (error) {
      throw new Error(
        `Could not queue ${data.kind} mail for ${data.to}: ${describe(error)}`,
        { cause: error },
      );
    }
  }
}

function withDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`No response from the mail queue in ${milliseconds}ms.`));
    }, milliseconds);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
