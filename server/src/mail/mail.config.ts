import type { ConfigService } from '@nestjs/config';

export interface MailSender {
  readonly name: string;
  readonly address: string;
}

export interface SmtpSettings {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly password: string;
  readonly from: MailSender;
}

export interface MailSettings {
  /** Used in subjects and body copy, and as the display name on the envelope. */
  readonly brand: string;
  /**
   * Null when `ADMIN_EMAIL` or `APP_PASSWORD` is missing. Mail is then written
   * to the log instead of being sent, which keeps local flows usable without
   * a mailbox. The decision belongs here, at the configuration boundary, not
   * inside a transport that would have to inspect the environment itself.
   */
  readonly smtp: SmtpSettings | null;
}

const DEFAULT_BRAND = 'Hackathon Portal';
const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
const DEFAULT_SMTP_PORT = 465;

/**
 * Gmail is the default because that is the account shape `APP_PASSWORD`
 * implies. Any other provider only has to set host, port, and secure.
 */
export function readMailSettings(config: ConfigService): MailSettings {
  const brand = trimmed(config, 'MAIL_FROM_NAME') ?? DEFAULT_BRAND;
  const address = trimmed(config, 'ADMIN_EMAIL');
  const password = trimmed(config, 'APP_PASSWORD');

  if (address === null || password === null) {
    return { brand, smtp: null };
  }

  const port = readPort(config);

  return {
    brand,
    smtp: {
      host: trimmed(config, 'SMTP_HOST') ?? DEFAULT_SMTP_HOST,
      port,
      secure: readSecure(config, port),
      user: address,
      password,
      from: { name: brand, address },
    },
  };
}

function trimmed(config: ConfigService, key: string): string | null {
  const value = config.get<string>(key)?.trim();
  return value === undefined || value.length === 0 ? null : value;
}

function readPort(config: ConfigService): number {
  const raw = trimmed(config, 'SMTP_PORT');
  if (raw === null) {
    return DEFAULT_SMTP_PORT;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`SMTP_PORT must be a whole number between 1 and 65535.`);
  }

  return port;
}

function readSecure(config: ConfigService, port: number): boolean {
  const raw = trimmed(config, 'SMTP_SECURE');
  if (raw === null) {
    // 465 is implicit TLS; 587 upgrades with STARTTLS instead.
    return port === 465;
  }

  const value = raw.toLowerCase();
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }

  throw new Error('SMTP_SECURE must be true or false.');
}
