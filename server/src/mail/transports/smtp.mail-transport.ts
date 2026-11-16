import { Inject, Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { MailSettings, SmtpSettings } from '../mail.config.js';
import { MAIL_SETTINGS } from '../mail.constants.js';
import type { RenderedMail } from '../mail.types.js';
import type { MailTransport } from './mail-transport.js';

/**
 * The real sender. The nodemailer transport is built on first use rather than
 * in the constructor: the module registers this provider even when SMTP is not
 * configured, and building a pooled connection for a mailbox that will never
 * be used would be wasted startup work and a source of confusion.
 */
@Injectable()
export class SmtpMailTransport implements MailTransport {
  private transporter: Transporter | undefined;

  constructor(@Inject(MAIL_SETTINGS) private readonly settings: MailSettings) {}

  async send(message: RenderedMail): Promise<void> {
    const smtp = this.settings.smtp;
    if (smtp === null) {
      throw new Error('SMTP transport was selected without credentials.');
    }

    await this.transporterFor(smtp).sendMail({
      from: smtp.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private transporterFor(smtp: SmtpSettings): Transporter {
    this.transporter ??= nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
    });

    return this.transporter;
  }
}
