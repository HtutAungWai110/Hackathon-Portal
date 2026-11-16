import { Inject, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { MailSettings } from './mail.config.js';
import { MAIL_QUEUE, MAIL_SETTINGS } from './mail.constants.js';
import { renderMail } from './mail.templates.js';
import type { MailJobData } from './mail.types.js';
import { MAIL_TRANSPORT } from './transports/mail-transport.js';
import type { MailTransport } from './transports/mail-transport.js';

/**
 * The worker. Rendering happens per attempt, so changing a template also fixes
 * mail that is already queued, and a send failure rejects the job, which is
 * what tells BullMQ to apply the backoff instead of dropping the message.
 *
 * Concurrency stays low: a burst of verification mail is not worth competing
 * with the API for connections, and the queue absorbs the wait.
 */
@Processor(MAIL_QUEUE, { concurrency: 2 })
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    @Inject(MAIL_SETTINGS) private readonly settings: MailSettings,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
  ) {
    super();
  }

  async process(job: Job<MailJobData>): Promise<void> {
    const message = renderMail(job.data, this.settings.brand);
    await this.transport.send(message);
  }

  /**
   * Without a handler, an `error` event on the worker is an unhandled
   * EventEmitter error and takes the process down. A Redis blip should cost
   * mail, not the API, so it is logged here.
   */
  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error(`Mail worker error: ${error.message}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<MailJobData> | undefined, error: Error): void {
    this.logger.error(
      `Mail job ${job?.id ?? 'unknown'} (${job?.name ?? 'unknown'}) failed after ${job?.attemptsMade ?? 0} attempt(s): ${error.message}`,
    );
  }
}
