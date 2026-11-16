import { Test } from '@nestjs/testing';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { MailSettings } from '../mail.config.js';
import { MAIL_SETTINGS } from '../mail.constants.js';
import type { RenderedMail } from '../mail.types.js';
import { SmtpMailTransport } from './smtp.mail-transport.js';

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn() },
}));

const SETTINGS: MailSettings = {
  brand: 'Winter Jam',
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    user: 'admin@example.com',
    password: 'app-password',
    from: { name: 'Winter Jam', address: 'admin@example.com' },
  },
};

const MESSAGE: RenderedMail = {
  to: 'ada@example.com',
  subject: 'Confirm your email for Winter Jam',
  text: 'text body',
  html: '<p>html body</p>',
  url: 'http://localhost:5173/login?token=abc',
};

async function setUp(settings: MailSettings = SETTINGS) {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'sent' });
  vi.mocked(nodemailer.createTransport).mockReturnValue({
    sendMail,
  } as unknown as Transporter);

  const moduleRef = await Test.createTestingModule({
    providers: [
      SmtpMailTransport,
      { provide: MAIL_SETTINGS, useValue: settings },
    ],
  }).compile();

  return {
    transport: moduleRef.get(SmtpMailTransport),
    createTransport: vi.mocked(nodemailer.createTransport),
    sendMail,
  };
}

describe('SmtpMailTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connects with the configured mailbox and no pooling surprises', async () => {
    const { transport } = await setUp();

    await transport.send(MESSAGE);

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'admin@example.com', pass: 'app-password' },
    });
  });

  it('sends both bodies from the configured address', async () => {
    const { transport, sendMail } = await setUp();

    await transport.send(MESSAGE);

    expect(sendMail).toHaveBeenCalledWith({
      from: { name: 'Winter Jam', address: 'admin@example.com' },
      to: 'ada@example.com',
      subject: MESSAGE.subject,
      text: MESSAGE.text,
      html: MESSAGE.html,
    });
  });

  it('builds the SMTP connection once across sends', async () => {
    const { transport } = await setUp();

    await transport.send(MESSAGE);
    await transport.send(MESSAGE);

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });

  it('refuses to send when it was built without credentials', async () => {
    const { transport } = await setUp({ brand: 'Winter Jam', smtp: null });

    await expect(transport.send(MESSAGE)).rejects.toThrow(/without credentials/);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
});
