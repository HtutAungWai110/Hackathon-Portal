import { Injectable, Logger, Module } from '@nestjs/common';

export const AUTH_MAIL = Symbol('AUTH_MAIL');

export interface AuthMailMessage {
  readonly to: string;
  readonly url: string;
  readonly token: string;
}

/**
 * The mail boundary the auth factory depends on. Swapping the logging
 * implementation for a real provider only touches one class.
 */
export interface AuthMail {
  sendVerificationEmail(message: AuthMailMessage): Promise<void>;
  sendResetPassword(message: AuthMailMessage): Promise<void>;
}

/**
 * Development mail sink. Verification and reset links are written to the log
 * so the flows are usable locally without an email provider.
 */
@Injectable()
export class AuthMailService implements AuthMail {
  private readonly logger = new Logger(AuthMailService.name);

  async sendVerificationEmail({
    to,
    url,
    token,
  }: AuthMailMessage): Promise<void> {
    this.logger.log(
      `Verification email for ${to}: ${url} (token: ${token})`,
    );
  }

  async sendResetPassword({
    to,
    url,
    token,
  }: AuthMailMessage): Promise<void> {
    this.logger.log(`Password reset email for ${to}: ${url} (token: ${token})`);
  }
}

@Module({
  providers: [
    AuthMailService,
    { provide: AUTH_MAIL, useExisting: AuthMailService },
  ],
  exports: [AUTH_MAIL, AuthMailService],
})
export class AuthMailModule {}
