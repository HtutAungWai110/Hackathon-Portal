import type { MailJobData, MailJobKind, RenderedMail } from './mail.types.js';

interface Copy {
  readonly subject: (brand: string) => string;
  readonly heading: string;
  readonly intro: (brand: string) => string;
  readonly action: string;
  readonly footnote: string;
}

const COPY: Record<MailJobKind, Copy> = {
  verification: {
    subject: (brand) => `Confirm your email for ${brand}`,
    heading: 'Confirm your email',
    intro: (brand) =>
      `Use the link below to finish setting up your ${brand} account.`,
    action: 'Confirm email',
    footnote:
      'If you did not create an account, ignore this email. Nothing happens until the link is used.',
  },
  'password-reset': {
    subject: (brand) => `Reset your ${brand} password`,
    heading: 'Reset your password',
    intro: (brand) =>
      `Someone asked to reset the password for your ${brand} account.`,
    action: 'Choose a new password',
    footnote:
      'If this was not you, ignore this email. Your password stays the same until the link is used.',
  },
};

const HTML_ESCAPES = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
]);

/**
 * URLs carry query strings, so an unescaped `&` inside `href` would be read as
 * a second entity by some clients and break the link. Everything that reaches
 * the HTML template goes through here, including values that came from config.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    return HTML_ESCAPES.get(character) ?? character;
  });
}

/**
 * Rendering lives in one function so the worker and the tests see the same
 * copy. Both bodies say the same thing: the button and the raw link, because
 * a plain-text reader has no button.
 */
export function renderMail(data: MailJobData, brand: string): RenderedMail {
  const copy = COPY[data.kind];
  const safeBrand = escapeHtml(brand);
  const safeUrl = escapeHtml(data.url);
  const intro = copy.intro(brand);
  const text = [
    copy.heading,
    '',
    intro,
    '',
    data.url,
    '',
    copy.footnote,
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#0b0d0f;color:#e7edf3;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;border:3px solid #22d3ee;background:#11161b;">
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#22d3ee;">${safeBrand}</p>
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#e7edf3;">${copy.heading}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#a9b7c4;">${escapeHtml(intro)}</p>
          <p style="margin:0 0 20px;">
            <a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border:2px solid #0b0d0f;background:#22d3ee;color:#0b0d0f;font-size:14px;font-weight:700;text-decoration:none;">${copy.action}</a>
          </p>
          <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#7f909e;word-break:break-all;">If the button does not work, open this link:<br>${safeUrl}</p>
          <p style="margin:0;font-size:11px;line-height:1.6;color:#5f707e;">${copy.footnote}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    to: data.to,
    subject: copy.subject(brand),
    text,
    html,
    url: data.url,
  };
}
