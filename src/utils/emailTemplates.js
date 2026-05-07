const APP_NAME = process.env.APP_NAME || 'Book Me Events';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

function buildBaseHtml({ title, bodyHtml, ctaHref, ctaText }) {
  const safeTitle = escapeHtml(title);
  const safeCtaText = ctaText ? escapeHtml(ctaText) : '';
  const safeCtaHref = ctaHref ? escapeHtml(ctaHref) : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f7fb;">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" width="100%" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:22px 24px;background:#111827;color:#ffffff;">
                <div style="font-size:14px;opacity:.9;letter-spacing:.2px;">${escapeHtml(APP_NAME)}</div>
                <div style="font-size:20px;font-weight:700;margin-top:6px;">${safeTitle}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 24px;color:#111827;">
                ${bodyHtml}

                ${ctaHref && ctaText ? `
                <p style="margin:22px 0 10px;">
                  <a href="${safeCtaHref}" target="_blank" rel="noopener noreferrer"
                    style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
                    ${safeCtaText}
                  </a>
                </p>
                <p style="margin:0;color:#6b7280;font-size:12px;">
                  If the button doesn’t work, copy and paste this link into your browser:<br/>
                  <span style="word-break:break-all;">${safeCtaHref}</span>
                </p>
                ` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.6;">
                <div>Need help? Contact us anytime.</div>
                <div style="margin-top:6px;">© ${new Date().getFullYear()} ${escapeHtml(APP_NAME)}. All rights reserved.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function welcomeEmail({ firstName }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const subject = `Welcome to ${APP_NAME}`;
  const text = `Hi ${safeFirstName},\n\nWelcome to ${APP_NAME}!\n\nVerify your email by signing in and calling /api/v1/auth/verify-email.\n`;
  const html = buildBaseHtml({
    title: 'Welcome!',
    bodyHtml: `<p style="margin:0 0 12px;">Hi <b>${safeFirstName}</b>,</p><p style="margin:0 0 12px;">Welcome to <b>${escapeHtml(APP_NAME)}</b>!</p><p style="margin:0;color:#6b7280;">To complete verification, sign in and call <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace;background:#f3f4f6;padding:2px 6px;border-radius:8px;">/api/v1/auth/verify-email</code>.</p>`,
  });

  return { subject, text, html };
}

function passwordResetRequestedEmail({ firstName, resetLink }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeResetLink = String(resetLink || '');
  const subject = 'Reset your password';

  const text = `Hi ${safeFirstName},\n\nYou requested a password reset.\n\nReset link: ${safeResetLink}\n\nIf you didn't request this, you can ignore this email.`;

  const html = buildBaseHtml({
    title: 'Password reset',
    bodyHtml: `<p style="margin:0 0 12px;">Hi <b>${safeFirstName}</b>,</p><p style="margin:0 0 12px;">You requested a <b>password reset</b>.</p><p style="margin:0;color:#6b7280;">Please use the link below to set a new password.</p>`,
    ctaHref: safeResetLink,
    ctaText: 'Reset password',
  });

  return { subject, text, html };
}

function passwordResetSuccessEmail({ firstName }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const subject = 'Your password has been reset';
  const text = `Hi ${safeFirstName},\n\nYour password was successfully reset.`;

  const html = buildBaseHtml({
    title: 'Password updated',
    bodyHtml: `<p style="margin:0 0 12px;">Hi <b>${safeFirstName}</b>,</p><p style="margin:0;">Your password was successfully reset.</p>`,
  });

  return { subject, text, html };
}

module.exports = {
  welcomeEmail,
  passwordResetRequestedEmail,
  passwordResetSuccessEmail,
};

