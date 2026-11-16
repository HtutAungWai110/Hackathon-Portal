/**
 * What travels through Redis, and what a transport actually hands to an SMTP
 * server. The job payload is deliberately raw: the worker renders it on every
 * attempt, so a template fix applies to queued mail as well.
 */
export type MailJobKind = 'verification' | 'password-reset';

export interface MailJobData {
  readonly kind: MailJobKind;
  readonly to: string;
  readonly url: string;
}

export interface RenderedMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  /** Kept alongside the body so the log transport can show just the link. */
  readonly url: string;
}
