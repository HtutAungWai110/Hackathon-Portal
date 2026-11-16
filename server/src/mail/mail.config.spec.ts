import { ConfigService } from '@nestjs/config';
import { readMailSettings } from './mail.config.js';

function read(values: Record<string, string>) {
  return readMailSettings(new ConfigService(values));
}

describe('readMailSettings', () => {
  it('turns SMTP off when there is no password', () => {
    expect(read({ ADMIN_EMAIL: 'admin@example.com' }).smtp).toBeNull();
  });

  it('turns SMTP off when there is no sender address', () => {
    expect(read({ APP_PASSWORD: 'app-password' }).smtp).toBeNull();
  });

  it('defaults to Gmail on 465 with implicit TLS', () => {
    const settings = read({
      ADMIN_EMAIL: 'admin@example.com',
      APP_PASSWORD: 'app-password',
    });

    expect(settings.smtp).toEqual({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: 'admin@example.com',
      password: 'app-password',
      from: { name: 'Hackathon Portal', address: 'admin@example.com' },
    });
  });

  it('uses 587 as STARTTLS unless secure is stated', () => {
    const settings = read({
      ADMIN_EMAIL: 'admin@example.com',
      APP_PASSWORD: 'app-password',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
    });

    expect(settings.smtp).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
    });
  });

  it('lets an explicit SMTP_SECURE win over the port default', () => {
    const settings = read({
      ADMIN_EMAIL: 'admin@example.com',
      APP_PASSWORD: 'app-password',
      SMTP_PORT: '587',
      SMTP_SECURE: 'true',
    });

    expect(settings.smtp?.secure).toBe(true);
  });

  it('uses MAIL_FROM_NAME as the brand and the sender name', () => {
    const settings = read({
      ADMIN_EMAIL: 'admin@example.com',
      APP_PASSWORD: 'app-password',
      MAIL_FROM_NAME: '  Winter Jam  ',
    });

    expect(settings.brand).toBe('Winter Jam');
    expect(settings.smtp?.from.name).toBe('Winter Jam');
  });

  it('refuses a port that is not a number', () => {
    expect(() =>
      read({
        ADMIN_EMAIL: 'admin@example.com',
        APP_PASSWORD: 'app-password',
        SMTP_PORT: 'smtp',
      }),
    ).toThrow(/SMTP_PORT/);
  });

  it('refuses a secure flag it cannot interpret', () => {
    expect(() =>
      read({
        ADMIN_EMAIL: 'admin@example.com',
        APP_PASSWORD: 'app-password',
        SMTP_SECURE: 'sometimes',
      }),
    ).toThrow(/SMTP_SECURE/);
  });
});
