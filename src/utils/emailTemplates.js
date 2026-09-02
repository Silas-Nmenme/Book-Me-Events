const APP_NAME = process.env.APP_NAME || 'Book Me Events';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bookmeevent.netlify.app';

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  // For href/src/text attributes (still HTML-escape is OK)
  return escapeHtml(str);
}

function safeStr(v, fallback = '') {
  if (v === undefined || v === null) return fallback;
  const s = String(v);
  return s.trim() ? s : fallback;
}

function formatCurrency(amount, currency = 'NGN') {
  const cur = safeStr(currency, 'NGN').toUpperCase();

  // Treat null/undefined as 0? For emails we want consistent output.
  const num = Number(amount);
  const value = Number.isFinite(num) ? num : 0;

  // Fallback formatting if Intl fails.
  try {
    // Most NGN usage; still try locale formatting.
    const locale = process.env.EMAIL_LOCALE || 'en-NG';
    const nf = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Simple currency prefixing (emails are not guaranteed to support currency symbols reliably).
    const symbol = cur === 'NGN' ? '₦' : cur + ' ';
    if (cur === 'NGN') return `${symbol}${nf.format(value)}`;
    return `${nf.format(value)} ${cur}`;
  } catch {
    const fixed = value.toFixed(2);
    if (cur === 'NGN') return `₦${fixed}`;
    return `${fixed} ${cur}`;
  }
}

function formatDate(value, { locale = 'en-NG', options } = {}) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const fmt = options || { year: 'numeric', month: 'short', day: '2-digit' };
  try {
    return new Intl.DateTimeFormat(locale, fmt).format(d);
  } catch {
    return d.toDateString();
  }
}

function buildFooter() {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;border-top:1px solid #e5e7eb;">
      <tr>
        <td style="padding:18px 24px;">
          <div style="font-family:DM Sans, Arial, Helvetica, sans-serif;font-size:13px;line-height:1.6;color:#4b5563;">
            <strong style="color:#111827;">Need help?</strong> Reply to this email and our support team will assist you.
          </div>
          <div style="margin-top:10px;font-family:DM Sans, Arial, Helvetica, sans-serif;font-size:12px;line-height:1.6;color:#6b7280;">
            You’re receiving this email because of your account on <strong style="color:#374151;">${escapeHtml(APP_NAME)}</strong>.
          </div>
        </td>
      </tr>
    </table>
  `;
}

function buildKeyValueRows(rows = []) {
  // rows: [{label, value}]
  return rows
    .filter((r) => r)
    .map(({ label, value }) => {
      const safeLabel = escapeHtml(label || '');
      const safeValue = escapeHtml(value === undefined || value === null ? '' : String(value));
      return `
        <tr>
          <td width="38%" style="padding:10px 14px;background:#f8fafc;color:#64748b;font-size:13px;font-weight:700;vertical-align:top;border-right:1px solid #eef2f7;">
            ${safeLabel}
          </td>
          <td width="62%" style="padding:10px 14px;background:#f8fafc;color:#0f172a;font-size:13px;vertical-align:top;">
            ${safeValue}
          </td>
        </tr>
      `;
    })
    .join('');
}

function buildBaseEmail({ title, statusLabel, bodyInnerHtml, ctaHref, ctaText }) {
  const safeTitle = escapeHtml(title || '');
  const safeStatus = statusLabel ? escapeHtml(statusLabel) : '';
  const safeCtaHref = ctaHref ? escapeAttr(ctaHref) : '';
  const safeCtaText = ctaText ? escapeHtml(ctaText) : '';

  const showCta = Boolean(safeCtaHref && safeCtaText);
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#ecfeff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ecfeff;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:22px 24px;background:#064E3B;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family:Sora, Georgia, 'Times New Roman', Times, serif;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#D1FAE5;font-weight:800;">
                      ${escapeHtml(APP_NAME)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:8px;font-family:Sora, Georgia, 'Times New Roman', Times, serif;">
                      <div style="font-size:24px;line-height:1.2;font-weight:900;color:#ffffff;">${safeTitle}</div>
                      ${safeStatus ? `<div style="margin-top:10px;display:inline-block;padding:8px 14px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:999px;font-size:12px;font-weight:800;letter-spacing:0.02em;color:#ECFDF5;">${safeStatus}</div>` : ''}
                    </td>
                  </tr>
                  <tr><td style="height:4px;">&nbsp;</td></tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 20px 10px;">
                <div style="font-family:DM Sans, Arial, Helvetica, sans-serif;color:#0f172a;font-size:14px;line-height:1.6;">
                  ${bodyInnerHtml}
                </div>

                ${showCta ? `
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
                    <tr>
                      <td align="center">
                        <a href="${safeCtaHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#10B981;color:#ffffff;text-decoration:none;font-family:DM Sans, Arial, Helvetica, sans-serif;font-size:14px;font-weight:900;padding:14px 20px;border-radius:12px;border:1px solid #0EA5A4;">
                          ${safeCtaText}
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-top:10px;">
                        <div style="font-family:DM Sans, Arial, Helvetica, sans-serif;font-size:12px;line-height:1.6;color:#6B7280;">
                          If the button doesn’t work, copy and paste this link into your browser:<br />
                          <a href="${safeCtaHref}" style="color:#0EA5A4;word-break:break-all;text-decoration:underline;">${safeCtaHref}</a>
                        </div>
                      </td>
                    </tr>
                  </table>
                ` : ''}

                <div style="height:10px;">&nbsp;</div>
              </td>
            </tr>

            <tr>
              <td>
                ${buildFooter()}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0;text-align:center;font-family:DM Sans, Arial, Helvetica, sans-serif;font-size:11px;color:#9CA3AF;">
                © ${year} ${escapeHtml(APP_NAME)}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function toPlainText({ lines }) {
  return lines.filter(Boolean).join('\n\n') + '\n';
}

function welcomeEmail({ firstName, role, verificationLink }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeRole = safeStr(role, 'USER');
  const subject = `Welcome to ${APP_NAME}`;

  const safeVerificationLink = safeStr(
    verificationLink,
    `${FRONTEND_URL.replace(/\/+$/, '')}/auth-login.html`
  );

  const ctaText = safeRole === 'VENDOR' ? 'Verify your vendor account' : 'Verify your email';

  const text = toPlainText({
    lines: [
      `Hi ${safeFirstName},`,
      `Welcome to ${APP_NAME}!`,
      `Complete your verification here: ${safeVerificationLink}`,
      '',
      `— ${APP_NAME}`,
    ],
  });

  const bodyInnerHtml = `
    <div style="background:linear-gradient(90deg,#0EA5E9,#064E3B);border-radius:14px;padding:18px 16px;color:#ffffff;">
      <div style="font-size:18px;font-weight:900;line-height:1.3;">Welcome aboard, ${safeFirstName}!</div>
      <div style="margin-top:8px;font-size:14px;line-height:1.6;opacity:0.95;">You’re now one step away from unlocking bookings, messages and seamless event management.</div>
    </div>

    <div style="padding-top:16px;">
      <p style="margin:0 0 8px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeFirstName}</strong>,</p>
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
        Thanks for joining <strong>${escapeHtml(APP_NAME)}</strong>. Please confirm your email address so we can activate your account.
      </p>
    </div>
  `;

  const html = buildBaseEmail({
    title: 'Welcome to Book Me Events',
    statusLabel: 'Action required',
    bodyInnerHtml,
    ctaHref: safeVerificationLink,
    ctaText,
  });

  return { subject, text, html };
}

function otpVerificationEmail({ firstName, otpCode, expiresInMinutes, purposeLabel }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeOtp = escapeHtml(safeStr(otpCode, ''));
  const safeMinutes = Number.isFinite(Number(expiresInMinutes)) ? Number(expiresInMinutes) : 10;
  const safePurpose = safeStr(purposeLabel, 'account verification');
  const subject = `Your ${APP_NAME} verification code`;

  const text = toPlainText({
    lines: [
      `Hi ${safeFirstName},`,
      `Your one-time code for ${safePurpose} is: ${safeOtp}`,
      `This code expires in ${safeMinutes} minutes.`,
      `If you didn’t request this, please ignore this email.`,
    ],
  });

  const bodyInnerHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeFirstName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      Use the code below to complete your ${escapeHtml(safePurpose)}. This code expires in ${safeMinutes} minutes.
    </p>
    <div style="text-align:center;padding:14px 0;">
      <span style="display:inline-block;padding:14px 28px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;font-size:28px;font-weight:900;letter-spacing:0.3em;color:#065f46;font-family:Sora, Georgia, 'Times New Roman', Times, serif;">
        ${safeOtp}
      </span>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      If you didn’t request this code, you can safely ignore this email.
    </p>
  `;

  const html = buildBaseEmail({
    title: 'Your verification code',
    statusLabel: 'Verification code',
    bodyInnerHtml,
  });

  return { subject, text, html };
}

function passwordResetRequestedEmail({ firstName, resetLink }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeResetLink = safeStr(resetLink, '');
  const subject = 'Reset your password';

  const text = toPlainText({
    lines: [
      `Hi ${safeFirstName},`,
      'You requested a password reset.',
      safeResetLink ? `Reset link: ${safeResetLink}` : 'Reset link: (unavailable)',
      `If you didn’t request this, please ignore this email.`,
    ],
  });

  const bodyInnerHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeFirstName}</strong>,</p>
    <p style="margin:0;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      We received a request to reset your password. If this was you, click the button below to continue.
      Otherwise, you can ignore this message and your password will stay the same.
    </p>
  `;

  const html = buildBaseEmail({
    title: 'Password Reset Requested',
    statusLabel: 'Security notice',
    bodyInnerHtml,
    ctaHref: safeResetLink,
    ctaText: 'Reset password',
  });

  return { subject, text, html };
}

function passwordResetSuccessEmail({ firstName }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const subject = 'Your password has been reset';

  const text = toPlainText({
    lines: [
      `Hi ${safeFirstName},`,
      'Your password was successfully reset.',
      'If you did not request this, contact support immediately.',
    ],
  });

  const bodyInnerHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeFirstName}</strong>,</p>
    <p style="margin:0;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      Your password has been changed successfully. You can now sign in with your new credentials.
    </p>
  `;

  const html = buildBaseEmail({
    title: 'Password Updated',
    bodyInnerHtml,
  });

  return { subject, text, html };
}

function loginSuccessEmail({ firstName, email }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeEmail = safeStr(email, '');
  const subject = `Login successful - ${APP_NAME}`;

  const lines = [
    `Hi ${safeFirstName},`,
    `You successfully signed in to ${APP_NAME}.`,
    safeEmail ? `Signed in as: ${safeEmail}` : '',
    'If this wasn’t you, please secure your account right away.',
  ].filter(Boolean);

  const text = lines.join('\n\n') + '\n';

  const bodyInnerHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeFirstName}</strong>,</p>
    <p style="margin:0 0 10px;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      You successfully signed in to <strong>${escapeHtml(APP_NAME)}</strong>. If this wasn’t you, please secure your account right away.
    </p>
    ${safeEmail ? `<p style="margin:0;font-size:12px;color:#6B7280;font-family:DM Sans, Arial, Helvetica, sans-serif;">Signed in as: <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">${escapeHtml(safeEmail)}</span></p>` : ''}
  `;

  const html = buildBaseEmail({
    title: 'Welcome back!',
    bodyInnerHtml,
  });

  return { subject, text, html };
}

function vendorVerificationSuccessEmail({ recipientName, vendorBusinessName }) {
  const safeRecipientName = escapeHtml(recipientName || 'there');
  const safeVendorBusinessName = escapeHtml(vendorBusinessName || 'your business');
  const subject = `Vendor verification approved - ${APP_NAME}`;

  const text = toPlainText({
    lines: [
      `Hi ${safeRecipientName},`,
      'Your vendor profile has been approved.',
      `Business: ${safeVendorBusinessName}`,
      'You can now start accepting bookings.',
    ],
  });

  const bodyInnerHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
      <tr>
        <td style="background:#ECFDF5;border:1px solid #D1FAE5;border-radius:14px;padding:16px;">
          <div style="font-size:16px;font-weight:900;color:#065F46;">Your vendor profile is live ✅</div>
          <div style="margin-top:8px;font-size:13px;line-height:1.7;color:#134E4A;font-family:DM Sans, Arial, Helvetica, sans-serif;">
            ${escapeHtml(APP_NAME)} is now ready to show your services to customers and receive booking requests.
          </div>
        </td>
      </tr>
    </table>

    <div style="font-size:14px;font-weight:900;color:#0f172a;margin:0 0 10px;">Account details</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:14px;overflow:hidden;">
      ${buildKeyValueRows([
        { label: 'Business name', value: safeVendorBusinessName },
        { label: 'Status', value: 'Verified and ready' },
      ])}
    </table>


    <div style="padding-top:14px;font-size:13px;line-height:1.7;color:#475569;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      Visit your vendor dashboard to manage services, pricing and new bookings.
    </div>
  `;

  const html = buildBaseEmail({
    title: 'Vendor verification approved',
    statusLabel: 'Approved',
    bodyInnerHtml,
    ctaText: 'Open dashboard',
    ctaHref: process.env.DASHBOARD_URL || '',
  });

  return { subject, text, html };
}

function safeVendorBusinessBusinessNameHack(value) {
  // no-op helper to avoid accidental refactor errors
  return value;
}

function vendorVerificationRequestedEmail({ recipientName, businessName }) {
  const safeRecipientName = escapeHtml(recipientName || 'there');
  const safeBusinessName = escapeHtml(businessName || 'your business');
  const subject = `We received your vendor verification - ${APP_NAME}`;

  const text = toPlainText({
    lines: [
      `Hi ${safeRecipientName},`,
      'We received your vendor verification request.',
      `Business: ${safeBusinessName}`,
      'We’ll notify you once it’s reviewed.',
    ],
  });

  const bodyInnerHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeRecipientName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      Thanks for submitting your vendor verification request. Our team is reviewing your business details now.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:14px;background:#F8FAFC;">
      ${buildKeyValueRows([
        { label: 'Business name', value: safeBusinessName },
        { label: 'Review status', value: 'Under review' },
      ])}
    </table>

    <div style="padding-top:14px;font-size:12px;line-height:1.6;color:#6B7280;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      You’ll receive an update as soon as the review is complete.
    </div>
  `;

  const html = buildBaseEmail({
    title: 'Vendor verification submitted',
    statusLabel: 'In review',
    bodyInnerHtml,
  });

  return { subject, text, html };
}

function vendorVerificationRejectedEmail({ recipientName, businessName, reason }) {
  const safeRecipientName = escapeHtml(recipientName || 'there');
  const safeBusinessName = escapeHtml(businessName || 'your business');
  const safeReason = escapeHtml(reason || 'Please review your submission and try again.');
  const subject = `Vendor verification rejected - ${APP_NAME}`;

  const text = toPlainText({
    lines: [
      `Hi ${safeRecipientName},`,
      'Your vendor verification request was rejected.',
      `Business: ${safeBusinessName}`,
      `Reason: ${safeReason}`,
      'Please update your details and resubmit.',
    ],
  });

  const bodyInnerHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeRecipientName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      We reviewed your vendor details and could not approve the request at this time. Please make the updates below and submit again.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #FCD34D;border-radius:14px;background:#FFF7ED;">
      <tr>
        <td style="padding:14px;">
          <div style="font-weight:900;color:#B45309;font-size:13px;margin:0 0 8px;font-family:DM Sans, Arial, Helvetica, sans-serif;">Review feedback</div>
          <div style="color:#92400E;font-size:13px;line-height:1.6;font-family:DM Sans, Arial, Helvetica, sans-serif;">${safeReason}</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-radius:14px;background:#F3F4F6;border:1px solid #E5E7EB;">
      <tr>
        <td style="padding:14px 14px 8px;">
          <div style="font-weight:900;color:#0f172a;font-size:13px;margin-bottom:8px;font-family:DM Sans, Arial, Helvetica, sans-serif;">Business details</div>
        </td>
      </tr>
      ${buildKeyValueRows([{ label: 'Business', value: safeBusinessName }])}
    </table>

    <div style="padding-top:14px;font-size:12px;line-height:1.6;color:#6B7280;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      Once you make the changes, resubmit your verification request and we’ll review it again.
    </div>
  `;

  const html = buildBaseEmail({
    title: 'Verification not approved',
    statusLabel: 'Action required',
    bodyInnerHtml,
  });

  return { subject, text, html };
}

function adminNewVendorApprovalRequestEmail({ adminName, vendorBusinessName, applicantName, applicantEmail }) {
  const safeAdminName = escapeHtml(adminName || 'Admin');
  const safeVendorBusinessName = escapeHtml(vendorBusinessName || 'a vendor');
  const safeApplicantName = escapeHtml(applicantName || 'Vendor');
  const safeApplicantEmail = escapeHtml(applicantEmail || '');

  const subject = `New vendor verification request - ${APP_NAME}`;
  const text = toPlainText({
    lines: [
      `Hi ${safeAdminName},`,
      'You have a new vendor verification request.',
      `Business: ${safeVendorBusinessName}`,
      `Applicant: ${safeApplicantName}`,
      `Applicant email: ${safeApplicantEmail || 'N/A'}`,
    ],
  });

  const bodyInnerHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeAdminName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      A new vendor verification request is waiting for your review. Please assess the submission and approve or reject it as appropriate.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:14px;background:#F8FAFC;">
      ${buildKeyValueRows([
        { label: 'Business', value: safeVendorBusinessName },
        { label: 'Applicant', value: safeApplicantName },
        { label: 'Email', value: safeApplicantEmail || 'N/A' },
      ])}
    </table>

    <div style="padding-top:14px;font-size:12px;line-height:1.6;color:#6B7280;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      Click the button below to open the admin dashboard and complete the review.
    </div>
  `;

  const html = buildBaseEmail({
    title: 'New vendor request',
    statusLabel: 'Review required',
    bodyInnerHtml,
    ctaText: 'Review request',
    ctaHref: process.env.ADMIN_DASHBOARD_URL || '',
  });

  return { subject, text, html };
}

function bookingCreatedEmail({ firstName, vendorName, serviceName, bookingDate, bookingTime, bookingUrl }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeVendorName = escapeHtml(vendorName || 'your vendor');
  const safeServiceName = escapeHtml(serviceName || 'your service');
  const safeDate = formatDate(bookingDate) || escapeHtml(bookingDate || 'TBD');
  const safeTime = safeStr(bookingTime, 'TBD');

  const subject = `Booking confirmed - ${APP_NAME}`;
  const text = toPlainText({
    lines: [
      `Hi ${safeFirstName},`,
      'Your booking has been confirmed.',
      `Vendor: ${safeVendorName}`,
      `Service: ${safeServiceName}`,
      `Date: ${safeDate}`,
      `Time: ${safeTime}`,
    ],
  });

  const bodyInnerHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeFirstName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      Your booking request has been confirmed. Below are the details of your upcoming event.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:14px;background:#F8FAFC;">
      ${buildKeyValueRows([
        { label: 'Vendor', value: safeVendorName },
        { label: 'Service', value: safeServiceName },
        { label: 'Date', value: safeDate || 'TBD' },
        { label: 'Time', value: safeTime || 'TBD' },
      ])}
    </table>

    <div style="padding-top:14px;font-size:12px;line-height:1.6;color:#6B7280;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      If you need to update your reservation, please reach out to your vendor directly.
    </div>
  `;

  const ctaHref = bookingUrl || `${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${''}`;

  const html = buildBaseEmail({
    title: 'Booking confirmed',
    statusLabel: 'Confirmed',
    bodyInnerHtml,
    ctaText: 'View bookings',
    ctaHref: ctaHref || process.env.BOOKINGS_URL || '',
  });

  return { subject, text, html };
}

function paymentReceiptEmail({ firstName, bookingId, amount, currency, paymentMethod, transactionReference, bookingDate, serviceName, vendorName, bookingUrl }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeBookingId = safeStr(bookingId, '—');
  const safeAmount = formatCurrency(amount ?? 0, currency || 'NGN');
  const safePaymentMethod = escapeHtml(paymentMethod || 'CARD');
  const safeTransactionReference = escapeHtml(transactionReference || '—');
  const safeBookingDate = formatDate(bookingDate) || escapeHtml(bookingDate || 'TBD');
  const safeServiceName = escapeHtml(serviceName || 'Service');
  const safeVendorName = escapeHtml(vendorName || 'Vendor');
  const safeBookingUrl = bookingUrl || `${process.env.BOOKINGS_URL || ''}` || `${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html`;

  const subject = `Payment receipt for booking ${escapeHtml(safeBookingId)} - ${APP_NAME}`;
  const text = toPlainText({
    lines: [
      `Hi ${safeFirstName},`,
      `Your payment for booking ${safeBookingId} was successful.`,
      `Service: ${safeServiceName}`,
      `Vendor: ${safeVendorName}`,
      `Amount: ${safeAmount}`,
      `Payment method: ${safePaymentMethod}`,
      `Reference: ${safeTransactionReference}`,
      `Date: ${safeBookingDate}`,
    ],
  });

  const bodyInnerHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#ECFDF5;border:1px solid #D1FAE5;border-radius:14px;padding:16px;">
          <div style="font-weight:900;font-size:16px;color:#065F46;font-family:DM Sans, Arial, Helvetica, sans-serif;">Payment confirmed successfully ✅</div>
          <div style="margin-top:8px;font-size:13px;color:#0F5132;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
            We have received your payment and your booking is now fully secured.
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:16px 0 10px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeFirstName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      Thank you for your payment. Here are the key details for your booking and receipt.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:14px;background:#F8FAFC;">
      ${buildKeyValueRows([
        { label: 'Booking ID', value: safeBookingId },
        { label: 'Service', value: safeServiceName },
        { label: 'Vendor', value: safeVendorName },
        { label: 'Amount', value: safeAmount },
        { label: 'Payment method', value: safePaymentMethod },
        { label: 'Reference', value: safeTransactionReference },
        { label: 'Booking date', value: safeBookingDate },
      ])}
    </table>

    <div style="padding-top:14px;font-size:12px;line-height:1.6;color:#6B7280;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      You can review the booking details anytime using the button below.
    </div>
  `;

  const html = buildBaseEmail({
    title: 'Payment received',
    statusLabel: 'Paid',
    bodyInnerHtml,
    ctaText: 'View booking',
    ctaHref: safeBookingUrl,
  });

  return { subject, text, html };
}

function vendorPaymentNotificationEmail({ vendorName, bookingId, amount, currency, paymentMethod, transactionReference, bookingDate, serviceName, customerName, bookingUrl }) {
  const safeVendorName = escapeHtml(vendorName || 'Vendor');
  const safeBookingId = safeStr(bookingId, '—');
  const safeAmount = formatCurrency(amount ?? 0, currency || 'NGN');
  const safePaymentMethod = escapeHtml(paymentMethod || 'CARD');
  const safeTransactionReference = escapeHtml(transactionReference || '—');
  const safeBookingDate = formatDate(bookingDate) || escapeHtml(bookingDate || 'TBD');
  const safeServiceName = escapeHtml(serviceName || 'Service');
  const safeCustomerName = escapeHtml(customerName || 'Customer');
  const safeBookingUrl = bookingUrl || `${process.env.BOOKINGS_URL || ''}` || `${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html`;

  const subject = `New payment received for booking ${escapeHtml(safeBookingId)} - ${APP_NAME}`;
  const text = toPlainText({
    lines: [
      `Hi ${safeVendorName},`,
      `A payment has been received for booking ${safeBookingId}.`,
      `Service: ${safeServiceName}`,
      `Customer: ${safeCustomerName}`,
      `Amount: ${safeAmount}`,
      `Payment method: ${safePaymentMethod}`,
      `Reference: ${safeTransactionReference}`,
      `Date: ${safeBookingDate}`,
    ],
  });

  const bodyInnerHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#ECFDF5;border:1px solid #D1FAE5;border-radius:14px;padding:16px;">
          <div style="font-weight:900;font-size:16px;color:#065F46;font-family:DM Sans, Arial, Helvetica, sans-serif;">A payment just cleared ✅</div>
          <div style="margin-top:8px;font-size:13px;color:#0F5132;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
            A customer has successfully paid for one of your bookings. Review the details below and prepare to deliver great service.
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:16px 0 10px;font-size:14px;color:#0f172a;font-family:DM Sans, Arial, Helvetica, sans-serif;">Hi <strong>${safeVendorName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.7;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      Payment details for the booking are listed below.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:14px;background:#F8FAFC;">
      ${buildKeyValueRows([
        { label: 'Booking ID', value: safeBookingId },
        { label: 'Service', value: safeServiceName },
        { label: 'Customer', value: safeCustomerName },
        { label: 'Amount', value: safeAmount },
        { label: 'Payment method', value: safePaymentMethod },
        { label: 'Reference', value: safeTransactionReference },
        { label: 'Booking date', value: safeBookingDate },
      ])}
    </table>

    <div style="padding-top:14px;font-size:12px;line-height:1.6;color:#6B7280;font-family:DM Sans, Arial, Helvetica, sans-serif;">
      Open the booking to confirm details and be ready for the scheduled service.
    </div>
  `;

  const html = buildBaseEmail({
    title: 'New payment received',
    statusLabel: 'Payment received',
    bodyInnerHtml,
    ctaText: 'View booking',
    ctaHref: safeBookingUrl,
  });

  return { subject, text, html };
}

module.exports = {
  welcomeEmail,
  otpVerificationEmail,
  passwordResetRequestedEmail,
  passwordResetSuccessEmail,
  loginSuccessEmail,

  vendorVerificationRequestedEmail,
  vendorVerificationSuccessEmail,
  vendorVerificationRejectedEmail,
  adminNewVendorApprovalRequestEmail,
  bookingCreatedEmail,
  paymentReceiptEmail,
  vendorPaymentNotificationEmail,
};

