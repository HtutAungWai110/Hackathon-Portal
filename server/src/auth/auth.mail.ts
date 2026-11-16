import { Injectable, Logger, Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { MailService } from '../mail/mail.service.js';
import type { MailJobKind } from '../mail/mail.types.js';

export const AUTH_MAIL = Symbol('AUTH_MAIL');

export interface AuthMailMessage {
  readonly to: string;
  readonly url: string;
  readonly token: string;
}

/**
 * The mail boundary the auth factory depends on. Better Auth calls these two
 * methods while handling a request, so they only describe what to send; the
 * queue does the sending.
 */
export interface AuthMail {
  sendVerificationEmail(message: AuthMailMessage): Promise<void>;
  sendResetPassword(message: AuthMailMessage): Promise<void>;
}

/**
 * Turns an auth flow into a queued job. The failure policy lives here on
 * purpose: an account that was already created must not be reported as failed
 * because Redis was away, and a person can always ask for another link. The
 * error is logged with the recipient so the gap is visible, and a job that
 * ioredis buffered is still delivered when the connection returns.
 */
@Injectable()
export class AuthMailService implements AuthMail {
  private readonly logger = new Logger(AuthMailService.name);

  constructor(private readonly mail: MailService) {}

  async sendVerificationEmail(message: AuthMailMessage): Promise<void> {
    await this.enqueue('verification', message);
  }

  async sendResetPassword(message: AuthMailMessage): Promise<void> {
    await this.enqueue('password-reset', message);
  }

  private async enqueue(
    kind: MailJobKind,
    { to, url }: AuthMailMessage,
  ): Promise<void> {
    try {
      await this.mail.enqueue({ kind, to, url });
    } catch (error) {
      this.logger.error(
        `Could not queue ${kind} mail for ${to}: ${describe(error)}`,
      );
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Module({
  imports: [MailModule],
  providers: [
    AuthMailService,
    { provide: AUTH_MAIL, useExisting: AuthMailService },
  ],
  exports: [AUTH_MAIL, AuthMailService],
})
export class AuthMailModule {}
