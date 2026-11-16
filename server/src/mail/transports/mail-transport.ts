import type { RenderedMail } from '../mail.types.js';

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

/**
 * The last hop before the network. The processor knows nothing about SMTP,
 * and the tests can prove the worker's behavior without a socket.
 *
 * A rejection means "try again": BullMQ retries the job, so a transient
 * connection or authentication failure is not silently dropped.
 */
export interface MailTransport {
  send(message: RenderedMail): Promise<void>;
}
