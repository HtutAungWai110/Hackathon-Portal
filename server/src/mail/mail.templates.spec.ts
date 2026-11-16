import type { MailJobData } from './mail.types.js';
import { escapeHtml, renderMail } from './mail.templates.js';

const VERIFY_URL =
  'http://localhost:5173/login?verified=true&token=abc.def-ghi';

function job(overrides: Partial<MailJobData> = {}): MailJobData {
  return {
    kind: 'verification',
    to: 'ada@example.com',
    url: VERIFY_URL,
    ...overrides,
  };
}

describe('renderMail', () => {
  it('names the brand in the verification subject', () => {
    const message = renderMail(job(), 'Winter Jam');

    expect(message.subject).toBe('Confirm your email for Winter Jam');
    expect(message.to).toBe('ada@example.com');
  });

  it('keeps the readable link in the text body', () => {
    const message = renderMail(job(), 'Winter Jam');

    expect(message.text).toContain(VERIFY_URL);
    expect(message.text).toContain('Confirm your email');
  });

  it('escapes the query string inside the HTML body', () => {
    const message = renderMail(job(), 'Winter Jam');

    expect(message.html).toContain(
      'http://localhost:5173/login?verified=true&amp;token=abc.def-ghi',
    );
    expect(message.html).not.toContain(VERIFY_URL);
  });

  it('cannot be broken out of with a crafted URL', () => {
    const message = renderMail(
      job({ url: 'https://example.com/?q="><script>alert(1)</script>' }),
      'Winter Jam',
    );

    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('escapes the brand too, because it comes from configuration', () => {
    const message = renderMail(job(), '<Winter & Jam>');

    expect(message.html).toContain('&lt;Winter &amp; Jam&gt;');
    expect(message.subject).toBe('Confirm your email for <Winter & Jam>');
  });

  it('uses reset copy for a reset job', () => {
    const message = renderMail(job({ kind: 'password-reset' }), 'Winter Jam');

    expect(message.subject).toBe('Reset your Winter Jam password');
    expect(message.text).toContain('reset the password');
    expect(message.text).toContain(VERIFY_URL);
    expect(message.url).toBe(VERIFY_URL);
  });
});

describe('escapeHtml', () => {
  it('escapes every character that can change markup', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});
