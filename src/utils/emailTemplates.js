const APP_NAME = process.env.APP_NAME || 'Book Me Events';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

function buildBaseHtml({ title, bodyHtml, ctaHref, ctaText, statusLabel }) {
  const safeTitle = escapeHtml(title);
  const safeCtaText = ctaText ? escapeHtml(ctaText) : '';
  const safeCtaHref = ctaHref ? escapeHtml(ctaHref) : '';
  const safeStatusLabel = statusLabel ? escapeHtml(statusLabel) : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>

    <!-- Bootstrap CDN (best-effort). Most styling below is inline/safe. -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />

    <style>
      /* Email-safe animations: many clients strip/limit animations. Keep them subtle + optional. */
      @keyframes bbFadeSlide {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes bbGlowPulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(37,99,235,.0); }
        50% { transform: scale(1.015); box-shadow: 0 14px 30px rgba(37,99,235,.25); }
      }

      .bb-hero { animation: bbFadeSlide 650ms ease-out both; }

      .bb-cta {
        display: inline-block;
        text-decoration: none;
        background: #2563eb;
        color: #ffffff !important;
        padding: 12px 18px;
        border-radius: 12px;
        font-weight: 800;
        letter-spacing: .2px;
      }
      .bb-cta:hover { background: #1d4ed8; animation: bbGlowPulse 900ms ease-in-out both; }

      /* Fallback shadow for clients that remove hover/animation */
      .bb-cta { box-shadow: 0 12px 26px rgba(37,99,235,.18); }

      @media (prefers-reduced-motion: reduce) {
        .bb-hero { animation: none !important; }
        .bb-cta:hover { animation: none !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f7fb;">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" width="100%" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eef2ff;">

            <!-- Header -->
            <tr>
              <td style="padding:26px 26px;background:linear-gradient(90deg,#0f172a,#2563eb);color:#ffffff;">
                <div style="font-size:13px;opacity:.93;letter-spacing:.3px;text-transform:uppercase;">${escapeHtml(APP_NAME)}</div>
                <div class="bb-hero" style="font-size:22px;line-height:1.2;font-weight:900;margin-top:8px;">${safeTitle}</div>

                ${safeStatusLabel ? `
                  <div style="margin-top:12px;display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);padding:7px 12px;border-radius:999px;font-size:12px;font-weight:900;">
                    ${safeStatusLabel}
                  </div>
                ` : ''}
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:22px 26px;color:#0f172a;">
                ${bodyHtml}

                ${ctaHref && ctaText ? `
                  <p style="margin:26px 0 10px;">
                    <a class="bb-cta" href="${safeCtaHref}" target="_blank" rel="noopener noreferrer">${safeCtaText}</a>
                  </p>
                  <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
                    If the button doesn’t work, copy and paste this link into your browser:<br/>
                    <span style="word-break:break-all;">${safeCtaHref}</span>
                  </p>
                ` : ''}

                <div style="margin-top:18px;font-size:12px;color:#6b7280;line-height:1.7;">
                  You’re receiving this email because of your account on <b>${escapeHtml(APP_NAME)}</b>.
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 26px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.6;">
                <div style="font-weight:900;color:#374151;margin-bottom:4px;">Need help?</div>
                <div>Reply to this email anytime.</div>
                <div style="margin-top:10px;color:#9ca3af;">© ${new Date().getFullYear()} ${escapeHtml(APP_NAME)}. All rights reserved.</div>
              </td>
            </tr>

            <!-- Subtle separator line -->
            <tr><td style="height:1px;background:#eef2ff;"></td></tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildInfoRow({ label, value }) {
  const safeLabel = escapeHtml(label || '');
  const safeValue = escapeHtml(value || '');
  return `
    <div class="row" style="margin:0 0 8px;">
      <div class="col-4" style="color:#6b7280;font-weight:700;font-size:12px;">${safeLabel}</div>
      <div class="col-8" style="color:#0f172a;font-weight:700;font-size:12px;">${safeValue}</div>
    </div>
  `;
}

function welcomeEmail({ firstName, role, verificationLink }) {
  const safeRole = escapeHtml(role || 'USER');

  const safeFirstName = escapeHtml(firstName || 'there');
  const subject = `Welcome to ${APP_NAME}`;


  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bookmeevent.netlify.app';
  const safeVerificationLink = String(
    verificationLink || `${FRONTEND_URL.replace(/\/+$/, '')}/auth-login.html`
  ).trim();

  const text = `Hi ${safeFirstName},\n\nWelcome to ${APP_NAME}!\n\nVerify your email by signing in: ${safeVerificationLink}\n`;

  const ctaText = safeRole === 'VENDOR' ? 'Verify your vendor email' : 'Verify your email';
  const html = buildBaseHtml({
    title: 'Welcome!',
    statusLabel: 'Action required',
    bodyHtml: `<p style="margin:0 0 12px;">Hi <b>${safeFirstName}</b>,</p><p style="margin:0 0 12px;">Welcome to <b>${escapeHtml(APP_NAME)}</b>!</p><p style="margin:0;color:#6b7280;">To complete verification, click the button below. This email verifies your account and unlocks full access.</p>`,
    ctaText,
    ctaHref: safeVerificationLink,
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

function loginSuccessEmail({ firstName, email }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeEmail = escapeHtml(email || '');

  const subject = `Login successful - ${APP_NAME}`;
  const text = `Hi ${safeFirstName},\n\nYou successfully signed in to ${APP_NAME}.`;

  const bodyLines = [
    `<p style="margin:0 0 12px;">Hi <b>${safeFirstName}</b>,</p>`,
    `<p style="margin:0;">You successfully signed in to <b>${escapeHtml(APP_NAME)}</b>.</p>`,
  ];

  if (safeEmail) {
    bodyLines.push(
      `<p style="margin:12px 0 0;color:#6b7280;">Signed in as: <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace;">${safeEmail}</span></p>`
    );
  }

  const html = buildBaseHtml({
    title: 'Welcome back!',
    bodyHtml: bodyLines.join(''),
  });

  return { subject, text, html };
}

function vendorVerificationSuccessEmail({ recipientName, vendorBusinessName }) {
  const safeRecipientName = escapeHtml(recipientName || 'there');
  const safeVendorBusinessName = escapeHtml(vendorBusinessName || 'your business');
  const subject = `Vendor verification approved - ${APP_NAME}`;
  const text = `Hi ${safeRecipientName},\n\nYour vendor profile has been approved.\n\nBusiness: ${safeVendorBusinessName}\n`;

  const html = buildBaseHtml({
    title: 'Verification Approved',
    statusLabel: 'Approved',
    bodyHtml: `
      <div class="bb-hero" style="background:#f3f4f6;border-radius:14px;padding:16px 14px;margin:0 0 14px;">
        <div style="font-weight:800;font-size:16px;color:#0f172a;margin:0;">Your vendor account is now verified ✅</div>
        <div style="margin-top:8px;color:#6b7280;font-size:13px;line-height:1.6;">You can now start receiving bookings on ${escapeHtml(APP_NAME)}.</div>
      </div>

      <div style="margin:0 0 6px;color:#0f172a;font-weight:800;">Details</div>
      ${buildInfoRow({ label: 'Business', value: safeVendorBusinessName })}
      ${buildInfoRow({ label: 'Next step', value: 'Go to your dashboard and manage availability' })}

      <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
        If you have questions, just reply to this email.
      </p>
    `,
    ctaText: 'View dashboard',
    ctaHref: process.env.DASHBOARD_URL || '',
  });

  return { subject, text, html };
}

function vendorVerificationRequestedEmail({ recipientName, businessName }) {
  const safeRecipientName = escapeHtml(recipientName || 'there');
  const safeBusinessName = escapeHtml(businessName || 'your business');
  const subject = `We received your vendor verification - ${APP_NAME}`;
  const text = `Hi ${safeRecipientName},\n\nWe received your vendor verification request.\nBusiness: ${safeBusinessName}\n\nWe’ll notify you once it’s reviewed.`;

  const html = buildBaseHtml({
    title: 'Verification Received',
    statusLabel: 'In Review',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;">Hi <b>${safeRecipientName}</b>,</p>
      <p style="margin:0 0 12px;color:#6b7280;font-size:13px;line-height:1.6;">
        Thanks for submitting your vendor verification. We’re reviewing your application now.
      </p>

      <div style="background:#f3f4f6;border-radius:14px;padding:16px 14px;">
        <div style="font-weight:800;color:#0f172a;margin:0 0 8px;">Application</div>
        ${buildInfoRow({ label: 'Business', value: safeBusinessName })}
        ${buildInfoRow({ label: 'Status', value: 'Under review' })}
      </div>

      <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
        You’ll receive another email when your verification is approved or rejected.
      </p>
    `,
  });

  return { subject, text, html };
}

function vendorVerificationRejectedEmail({ recipientName, businessName, reason }) {
  const safeRecipientName = escapeHtml(recipientName || 'there');
  const safeBusinessName = escapeHtml(businessName || 'your business');
  const safeReason = escapeHtml(reason || 'Please review your submission and try again.');
  const subject = `Vendor verification rejected - ${APP_NAME}`;
  const text = `Hi ${safeRecipientName},\n\nYour vendor verification request was rejected.\nBusiness: ${safeBusinessName}\nReason: ${safeReason}\n\nYou can resubmit after updating your details.`;

  const html = buildBaseHtml({
    title: 'Verification Not Approved',
    statusLabel: 'Rejected',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;">Hi <b>${safeRecipientName}</b>,</p>
      <p style="margin:0 0 12px;color:#6b7280;font-size:13px;line-height:1.6;">
        We’re unable to approve your vendor verification at this time.
      </p>

      <div style="background:#fff7ed;border-radius:14px;padding:16px 14px; border:1px solid #fed7aa;">
        <div style="font-weight:900;color:#7c2d12;margin:0 0 8px;">Reason</div>
        <div style="color:#7c2d12;font-size:13px;line-height:1.6;">${safeReason}</div>
      </div>

      <div style="margin-top:12px;background:#f3f4f6;border-radius:14px;padding:16px 14px;">
        <div style="font-weight:800;color:#0f172a;margin:0 0 8px;">Application</div>
        ${buildInfoRow({ label: 'Business', value: safeBusinessName })}
      </div>

      <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
        Please update your details and submit again when ready.
      </p>
    `,
  });

  return { subject, text, html };
}

function adminNewVendorApprovalRequestEmail({ adminName, vendorBusinessName, applicantName, applicantEmail }) {
  const safeAdminName = escapeHtml(adminName || 'Admin');
  const safeVendorBusinessName = escapeHtml(vendorBusinessName || 'a vendor');
  const safeApplicantName = escapeHtml(applicantName || 'Vendor');
  const safeApplicantEmail = escapeHtml(applicantEmail || '');

  const subject = `New vendor verification request - ${APP_NAME}`;

  const text = `Hi ${safeAdminName},\n\nYou have a new vendor verification request.\n\nBusiness: ${safeVendorBusinessName}\nApplicant: ${safeApplicantName}\nApplicant email: ${safeApplicantEmail}\n`;

  const html = buildBaseHtml({
    title: 'New Vendor Request',
    statusLabel: 'Action Required',
    bodyHtml: `
      <p style="margin:0 0 10px;color:#0f172a;font-size:14px;">Hi <b>${safeAdminName}</b>,</p>
      <p style="margin:0 0 14px;color:#6b7280;font-size:13px;line-height:1.6;">
        A new vendor verification request has been submitted.
      </p>

      <div style="background:#f3f4f6;border-radius:14px;padding:16px 14px;">
        <div style="font-weight:900;color:#0f172a;margin:0 0 8px;">Request details</div>
        ${buildInfoRow({ label: 'Business', value: safeVendorBusinessName })}
        ${buildInfoRow({ label: 'Applicant', value: safeApplicantName })}
        ${buildInfoRow({ label: 'Email', value: safeApplicantEmail || 'N/A' })}
      </div>

      <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
        Please review the request in the admin dashboard.
      </p>
    `,
    ctaText: 'Review in dashboard',
    ctaHref: process.env.ADMIN_DASHBOARD_URL || '',
  });

  return { subject, text, html };
}

function bookingCreatedEmail({ firstName, vendorName, serviceName, bookingDate, bookingTime }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeVendorName = escapeHtml(vendorName || 'your vendor');
  const safeServiceName = escapeHtml(serviceName || 'your service');
  const safeBookingDate = escapeHtml(bookingDate || '');
  const safeBookingTime = escapeHtml(bookingTime || '');

  const subject = `Booking confirmed - ${APP_NAME}`;
  const text = `Hi ${safeFirstName},\n\nYour booking has been created.\nVendor: ${safeVendorName}\nService: ${safeServiceName}\nDate: ${safeBookingDate}\nTime: ${safeBookingTime}`;

  const html = buildBaseHtml({
    title: 'Booking Confirmed',
    statusLabel: 'Confirmed',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;">Hi <b>${safeFirstName}</b>,</p>
      <p style="margin:0 0 14px;color:#6b7280;font-size:13px;line-height:1.6;">
        We’re excited to confirm your booking. Here are the details:
      </p>

      <div style="background:#f3f4f6;border-radius:14px;padding:16px 14px;">
        ${buildInfoRow({ label: 'Vendor', value: safeVendorName })}
        ${buildInfoRow({ label: 'Service', value: safeServiceName })}
        ${buildInfoRow({ label: 'Date', value: safeBookingDate || 'TBD' })}
        ${buildInfoRow({ label: 'Time', value: safeBookingTime || 'TBD' })}
      </div>

      <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
        If you need to make changes, contact your vendor.
      </p>
    `,
    ctaText: 'View bookings',
    ctaHref: process.env.BOOKINGS_URL || '',
  });

  return { subject, text, html };
}

function paymentReceiptEmail({ firstName, bookingId, amount, currency, paymentMethod, transactionReference, bookingDate, serviceName, vendorName, bookingUrl }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeBookingId = escapeHtml(bookingId || '—');
  const safeAmount = escapeHtml(amount != null ? `${currency || 'NGN'} ${Number(amount).toLocaleString()}` : '—');
  const safePaymentMethod = escapeHtml(paymentMethod || 'CARD');
  const safeTransactionReference = escapeHtml(transactionReference || '—');
  const safeBookingDate = escapeHtml(bookingDate || 'TBD');
  const safeServiceName = escapeHtml(serviceName || 'Service');
  const safeVendorName = escapeHtml(vendorName || 'Vendor');
  const safeBookingUrl = escapeHtml(bookingUrl || process.env.BOOKINGS_URL || '');

  const subject = `Payment receipt for booking ${safeBookingId} - ${APP_NAME}`;
  const text = `Hi ${safeFirstName},\n\nYour payment for booking ${safeBookingId} was successful.\nService: ${safeServiceName}\nVendor: ${safeVendorName}\nAmount: ${safeAmount}\nPayment method: ${safePaymentMethod}\nReference: ${safeTransactionReference}\nDate: ${safeBookingDate}\n`;

  const html = buildBaseHtml({
    title: 'Payment received',
    statusLabel: 'Paid',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;">Hi <b>${safeFirstName}</b>,</p>
      <p style="margin:0 0 14px;color:#6b7280;font-size:13px;line-height:1.6;">
        Your payment has been received successfully. Thank you for booking with <b>${escapeHtml(APP_NAME)}</b>.
      </p>
      <div style="background:#f3f4f6;border-radius:14px;padding:16px 14px;">
        ${buildInfoRow({ label: 'Booking ID', value: safeBookingId })}
        ${buildInfoRow({ label: 'Service', value: safeServiceName })}
        ${buildInfoRow({ label: 'Vendor', value: safeVendorName })}
        ${buildInfoRow({ label: 'Amount', value: safeAmount })}
        ${buildInfoRow({ label: 'Payment method', value: safePaymentMethod })}
        ${buildInfoRow({ label: 'Reference', value: safeTransactionReference })}
        ${buildInfoRow({ label: 'Booking date', value: safeBookingDate })}
      </div>
      <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
        You can view your booking with the button below.
      </p>
    `,
    ctaText: 'View booking',
    ctaHref: safeBookingUrl,
  });

  return { subject, text, html };
}

function vendorPaymentNotificationEmail({ vendorName, bookingId, amount, currency, paymentMethod, transactionReference, bookingDate, serviceName, customerName, bookingUrl }) {
  const safeVendorName = escapeHtml(vendorName || 'Vendor');
  const safeBookingId = escapeHtml(bookingId || '—');
  const safeAmount = escapeHtml(amount != null ? `${currency || 'NGN'} ${Number(amount).toLocaleString()}` : '—');
  const safePaymentMethod = escapeHtml(paymentMethod || 'CARD');
  const safeTransactionReference = escapeHtml(transactionReference || '—');
  const safeBookingDate = escapeHtml(bookingDate || 'TBD');
  const safeServiceName = escapeHtml(serviceName || 'Service');
  const safeCustomerName = escapeHtml(customerName || 'Customer');
  const safeBookingUrl = escapeHtml(bookingUrl || process.env.BOOKINGS_URL || '');

  const subject = `New payment received for booking ${safeBookingId} - ${APP_NAME}`;
  const text = `Hi ${safeVendorName},\n\nA payment has been received for booking ${safeBookingId}.\nService: ${safeServiceName}\nCustomer: ${safeCustomerName}\nAmount: ${safeAmount}\nPayment method: ${safePaymentMethod}\nReference: ${safeTransactionReference}\nDate: ${safeBookingDate}\n`;

  const html = buildBaseHtml({
    title: 'Payment received',
    statusLabel: 'New payment',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;">Hi <b>${safeVendorName}</b>,</p>
      <p style="margin:0 0 14px;color:#6b7280;font-size:13px;line-height:1.6;">
        A payment has been successfully received for one of your bookings.
      </p>
      <div style="background:#f3f4f6;border-radius:14px;padding:16px 14px;">
        ${buildInfoRow({ label: 'Booking ID', value: safeBookingId })}
        ${buildInfoRow({ label: 'Service', value: safeServiceName })}
        ${buildInfoRow({ label: 'Customer', value: safeCustomerName })}
        ${buildInfoRow({ label: 'Amount', value: safeAmount })}
        ${buildInfoRow({ label: 'Payment method', value: safePaymentMethod })}
        ${buildInfoRow({ label: 'Reference', value: safeTransactionReference })}
        ${buildInfoRow({ label: 'Booking date', value: safeBookingDate })}
      </div>
      <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
        Open your dashboard to manage the booking.
      </p>
    `,
    ctaText: 'View booking',
    ctaHref: safeBookingUrl,
  });

  return { subject, text, html };
}

module.exports = {
  welcomeEmail,
  passwordResetRequestedEmail,
  passwordResetSuccessEmail,
  loginSuccessEmail,

  // Vendor/Admin/Booking templates
  vendorVerificationRequestedEmail,
  vendorVerificationSuccessEmail,
  vendorVerificationRejectedEmail,
  adminNewVendorApprovalRequestEmail,
  bookingCreatedEmail,
  paymentReceiptEmail,
  vendorPaymentNotificationEmail,
};
