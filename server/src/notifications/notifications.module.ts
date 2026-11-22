import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module.js';
import {
  NOTIFICATION_QUEUE,
} from './notifications.constants.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { NotificationsProcessor } from './notifications.processor.js';
import { NotificationsService } from './notifications.service.js';

/**
 * The notice inbox. The producer (`NotificationsService.notify`) is called by
 * features that should announce something (event registrations); the worker
 * writes rows and pushes them over the socket; the controller serves the
 * unread page for a poll-friendly fallback.
 *
 * The queue is registered here, once; `BullModule.forRootAsync` in AppModule
 * is what gives every module the same Redis connection.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 500 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    }),
    SessionModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
