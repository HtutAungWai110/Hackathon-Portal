import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { MailSettings } from './mail.config.js';
import { readMailSettings } from './mail.config.js';
import { MAIL_QUEUE, MAIL_SETTINGS } from './mail.constants.js';
import { MailProcessor } from './mail.processor.js';
import { MailService } from './mail.service.js';
import { MAIL_TRANSPORT } from './transports/mail-transport.js';
import type { MailTransport } from './transports/mail-transport.js';
import { LogMailTransport } from './transports/log.mail-transport.js';
import { SmtpMailTransport } from './transports/smtp.mail-transport.js';

/**
 * Mail is asynchronous by design: the producer stores a job and returns, and
 * the worker in this same process does the slow part. One module owns the
 * queue name, the job defaults, both transports, and the worker, so there is
 * no second place to change when the sending story changes.
 *
 * The shared Redis connection is registered once in `AppModule`; BullMQ's
 * configuration is global, and repeating it here would give the app two
 * competing sets of connection settings.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: MAIL_QUEUE,
      defaultJobOptions: {
        // Five tries at 5s, 10s, 20s, 40s covers a restart or a short SMTP
        // outage. A permanent rejection still lands in the failed set.
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
        // Failures are kept for a week: they are the only record that a
        // verification message never left, and the job id is in the log line.
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    }),
  ],
  providers: [
    {
      provide: MAIL_SETTINGS,
      inject: [ConfigService],
      useFactory: readMailSettings,
    },
    SmtpMailTransport,
    LogMailTransport,
    {
      provide: MAIL_TRANSPORT,
      inject: [MAIL_SETTINGS, SmtpMailTransport, LogMailTransport],
      // The composition root picks the implementation; neither transport
      // checks the environment itself.
      useFactory: (
        settings: MailSettings,
        smtp: SmtpMailTransport,
        log: LogMailTransport,
      ): MailTransport => (settings.smtp === null ? log : smtp),
    },
    MailService,
    MailProcessor,
  ],
  exports: [MailService],
})
export class MailModule {}
