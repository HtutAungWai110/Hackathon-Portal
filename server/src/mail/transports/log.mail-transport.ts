import { Injectable, Logger } from '@nestjs/common';
import type { MailTransport } from './mail-transport.js';
import type { RenderedMail } from '../mail.types.js';

/**
 * Used when no SMTP credentials are configured. It is a transport rather than
 * a special case in the worker, so the queue, the retries, and the job shape
 * are exercised in development exactly as they are in production.
 *
 * The link is printed because there is no mailbox to open; with credentials
 * configured this class is never selected, so tokens do not reach the log.
 */
@Injectable()
export class LogMailTransport implements MailTransport {
  private readonly logger = new Logger(LogMailTransport.name);

  async send(message: RenderedMail): Promise<void> {
    this.logger.log(
      `Mail not sent (no SMTP credentials). To ${message.to}: ${message.subject} — ${message.url}`,
    );
  }
}
