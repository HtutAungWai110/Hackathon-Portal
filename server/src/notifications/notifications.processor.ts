import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationsService } from './notifications.service.js';
import { NOTIFICATION_QUEUE } from './notifications.constants.js';
import type { NotificationJobData } from './notifications.types.js';

/**
 * The worker: it writes the rows, then pushes them to the rooms that were
 * already joined. Keeping the DB write here rather than in the producer
 * means the API answers without waiting for a row to exist, and a worker
 * failure (a Redis blip, a crash) costs delivery, not the request.
 */
@Processor(NOTIFICATION_QUEUE, { concurrency: 10 })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const rows = await this.notifications.store(job.data.notifications);
    for (const row of rows) {
      this.gateway.emitNew(row);
      const count = await this.notifications.unreadCount(row.receiverId);
      this.gateway.emitUnreadCount(row.receiverId, count);
    }
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error(`Notifications worker error: ${error.message}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NotificationJobData> | undefined, error: Error): void {
    this.logger.error(
      `Notifications job ${job?.id ?? 'unknown'} failed after ${job?.attemptsMade ?? 0} attempt(s): ${error.message}`,
    );
  }
}
