const APP_NAME = process.env.APP_NAME || 'Book Me Events';

function escapeHtml(str) {
  if (str === undefined || str === null) {
    return '';
  }

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
    <style>
      body { margin:0; padding:0; background:#eef2ff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .bb-wrapper { background:#eef2ff; padding:24px; }
      .bb-container { max-width:680px; margin:0 auto; background:#ffffff; border-radius:24px; overflow:hidden; border:1px solid #dbeafe; box-shadow:0 20px 60px rgba(15,23,42,.08); }
      .bb-header { padding:34px 32px 26px; background:linear-gradient(135deg,#1d4ed8,#0f172a); color:#ffffff; }
      .bb-brand { font-size:12px; letter-spacing:.22em; text-transform:uppercase; opacity:.86; margin-bottom:10px; }
      .bb-title { font-size:28px; line-height:1.1; font-weight:900; margin:0; }
      .bb-chip { display:inline-flex; align-items:center; padding:9px 16px; margin-top:18px; border-radius:999px; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.18); font-size:12px; font-weight:700; letter-spacing:.02em; }
      .bb-body { padding:28px 32px 32px; color:#0f172a; }
      .bb-copy { font-size:15px; line-height:1.72; color:#475569; margin:0 0 20px; }
      .bb-panel { width:100%; background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px; padding:18px 20px; margin:18px 0; }
      .bb-panel-heading { font-size:14px; font-weight:800; color:#0f172a; margin:0 0 12px; }
      .bb-detail-table { width:100%; border-collapse:collapse; margin-top:10px; }
      .bb-detail-table td { padding:11px 12px; border-bottom:1px solid #e2e8f0; font-size:13px; vertical-align:top; }
      .bb-detail-table td:first-child { width:34%; color:#64748b; font-weight:700; }
      .bb-detail-table td:last-child { color:#0f172a; }
      .bb-cta { display:inline-block; text-decoration:none; background:#2563eb; color:#ffffff !important; padding:14px 20px; border-radius:14px; font-weight:800; letter-spacing:.02em; box-shadow:0 14px 32px rgba(37,99,235,.18); }
      .bb-cta:hover { background:#1d4ed8; }
      .bb-legal { font-size:12px; line-height:1.7; color:#94a3b8; margin-top:18px; }
      .bb-footer { padding:18px 32px 28px; background:#f8fafc; color:#64748b; font-size:12px; line-height:1.7; }
      .bb-footer strong { color:#334155; }
      @media (prefers-reduced-motion: reduce) {
        .bb-cta { transition:none !important; }
      }
    </style>
  </head>
  <body>
    <div class="bb-wrapper">
      <div class="bb-container">
        <div class="bb-header">
          <div class="bb-brand">${escapeHtml(APP_NAME)}</div>
          <h1 class="bb-title">${safeTitle}</h1>
          ${safeStatusLabel ? `<div class="bb-chip">${safeStatusLabel}</div>` : ''}
        </div>
        <div class="bb-body">
          ${bodyHtml}
          ${ctaHref && ctaText ? `
            <p style="margin:24px 0 12px;"><a class="bb-cta" href="${safeCtaHref}" target="_blank" rel="noopener noreferrer">${safeCtaText}</a></p>
            <p class="bb-legal">If the button doesn’t work, copy and paste this link into your browser:<br><a href="${safeCtaHref}" style="color:#2563eb;word-break:break-all;">${safeCtaHref}</a></p>
          ` : ''}
          <div class="bb-legal">You’re receiving this email because of your account on <strong>${escapeHtml(APP_NAME)}</strong>.</div>
        </div>
        <div class="bb-footer">
          <div><strong>Need help?</strong> Reply to this email and our support team will assist you.</div>
          <div style="margin-top:10px;">© ${new Date().getFullYear()} ${escapeHtml(APP_NAME)}. All rights reserved.</div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function buildInfoRow({ label, value }) {
  return `
    <tr>
      <td style="padding:10px 14px;background:#f8fafc;color:#64748b;font-size:13px;font-weight:700;width:34%;vertical-align:top;">${escapeHtml(label || '')}</td>
      <td style="padding:10px 14px;background:#f8fafc;color:#0f172a;font-size:13px;vertical-align:top;">${escapeHtml(value || '')}</td>
    </tr>
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

  const text = `Hi ${safeFirstName},\n\nWelcome to ${APP_NAME}!\n\nComplete your verification here: ${safeVerificationLink}\n`;

  const ctaText = safeRole === 'VENDOR' ? 'Verify your vendor account' : 'Verify your email';
  const html = buildBaseHtml({
    title: 'Welcome to Book Me Events',
    statusLabel: 'Action required',
    bodyHtml: `
      <div style="background:linear-gradient(90deg,#4f46e5,#0ea5e9);border-radius:14px;padding:18px 16px;color:#ffffff;margin-bottom:20px;">
        <div style="font-size:18px;font-weight:800;line-height:1.3;">Welcome aboard, ${safeFirstName}!</div>
        <div style="margin-top:10px;font-size:14px;color:rgba(255,255,255,0.92);line-height:1.6;">You’re now one step away from unlocking bookings, messages and seamless event management.</div>
      </div>
      <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Hi <strong>${safeFirstName}</strong>,</p>
      <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.65;">Thanks for joining <strong>${escapeHtml(APP_NAME)}</strong>. Please confirm your email address below so we can activate your account and help you start booking with confidence.</p>
    `,
    ctaText,
    ctaHref: safeVerificationLink,
  });

  return { subject, text, html };
}

function passwordResetRequestedEmail({ firstName, resetLink }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeResetLink = String(resetLink || '');
  const subject = 'Reset your password';

  const text = `Hi ${safeFirstName},\n\nYou requested a password reset.\n\nReset link: ${safeResetLink}\n\nIf you didn't request this, please ignore this email.`;

  const html = buildBaseHtml({
    title: 'Password Reset Requested',
    statusLabel: 'Security notice',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Hi <strong>${safeFirstName}</strong>,</p>
      <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.65;">We received a request to reset your password. If this was you, click the button below to continue. Otherwise, you can ignore this message and your password will stay the same.</p>
    `,
    ctaHref: safeResetLink,
    ctaText: 'Reset password',
  });

  return { subject, text, html };
}

function passwordResetSuccessEmail({ firstName }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const subject = 'Your password has been reset';
  const text = `Hi ${safeFirstName},\n\nYour password was successfully reset. If you did not request this, contact support immediately.`;

  const html = buildBaseHtml({
    title: 'Password Updated',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Hi <strong>${safeFirstName}</strong>,</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.65;">Your password has been changed successfully. You can now sign in with your new credentials.</p>
    `,
  });

  return { subject, text, html };
}

function loginSuccessEmail({ firstName, email }) {
  const safeFirstName = escapeHtml(firstName || 'there');
  const safeEmail = escapeHtml(email || '');

  const subject = `Login successful - ${APP_NAME}`;
  const text = `Hi ${safeFirstName},\n\nYou successfully signed in to ${APP_NAME}.${safeEmail ? `\nSigned in as: ${safeEmail}` : ''}`;

  const bodyLines = [
    `<p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Hi <strong>${safeFirstName}</strong>,</p>`,
    `<p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.65;">You successfully signed in to <strong>${escapeHtml(APP_NAME)}</strong>. If this wasn’t you, please secure your account right away.</p>`,
  ];

  if (safeEmail) {
    bodyLines.push(
      `<p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">Signed in as: <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace;">${safeEmail}</span></p>`
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
  const text = `Hi ${safeRecipientName},\n\nYour vendor profile has been approved.\n\nBusiness: ${safeVendorBusinessName}\n\nYou can now start accepting bookings.`;

  const html = buildBaseHtml({
    title: 'Vendor verification approved',
    statusLabel: 'Approved',
    bodyHtml: `
      <div style="background:#ecfdf5;border-radius:14px;padding:18px 16px;margin:0 0 18px;border:1px solid #d1fae5;">
        <div style="font-weight:800;font-size:17px;color:#065f46;margin:0;">Your vendor profile is live ✅</div>
        <div style="margin-top:10px;color:#134e4a;font-size:13px;line-height:1.7;">${escapeHtml(APP_NAME)} is now ready to show your services to customers and receive booking requests.</div>
      </div>

      <div style="margin:0 0 12px;color:#0f172a;font-weight:700;font-size:14px;">Account details</div>
      ${buildInfoRow({ label: 'Business name', value: safeVendorBusinessName })}
      ${buildInfoRow({ label: 'Status', value: 'Verified and ready' })}

      <p style="margin:18px 0 0;color:#475569;font-size:13px;line-height:1.65;">Visit your vendor dashboard to manage services, pricing and new bookings.</p>
    `,
    ctaText: 'Open dashboard',
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
    title: 'Vendor verification submitted',
    statusLabel: 'In review',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Hi <strong>${safeRecipientName}</strong>,</p>
      <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.65;">
        Thanks for submitting your vendor verification request. Our team is reviewing your business details now.
      </p>

      <div style="background:#f8fafc;border-radius:14px;padding:16px 14px;border:1px solid #e2e8f0;">
        <div style="font-weight:700;color:#0f172a;margin:0 0 10px;">Submission summary</div>
        ${buildInfoRow({ label: 'Business name', value: safeBusinessName })}
        ${buildInfoRow({ label: 'Review status', value: 'Under review' })}
      </div>

      <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
        You’ll receive an update as soon as the review is complete.
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
  const text = `Hi ${safeRecipientName},\n\nYour vendor verification request was rejected.\nBusiness: ${safeBusinessName}\nReason: ${safeReason}\n\nPlease update your details and resubmit.`;

  const html = buildBaseHtml({
    title: 'Verification not approved',
    statusLabel: 'Action required',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Hi <strong>${safeRecipientName}</strong>,</p>
      <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.65;">
        We reviewed your vendor details and could not approve the request at this time. Please make the updates below and submit again.
      </p>

      <div style="background:#fff7ed;border-radius:14px;padding:16px 14px;border:1px solid #fcd34d;">
        <div style="font-weight:700;color:#b45309;margin:0 0 8px;">Review feedback</div>
        <div style="color:#92400e;font-size:13px;line-height:1.6;">${safeReason}</div>
      </div>

      <div style="margin-top:16px;background:#f3f4f6;border-radius:14px;padding:16px 14px;">
        <div style="font-weight:800;color:#0f172a;margin:0 0 8px;">Business details</div>
        ${buildInfoRow({ label: 'Business', value: safeBusinessName })}
      </div>

      <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
        Once you make the changes, resubmit your verification request and we’ll review it again.
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
  const text = `Hi ${safeAdminName},\n\nYou have a new vendor verification request.\n\nBusiness: ${safeVendorBusinessName}\nApplicant: ${safeApplicantName}\nApplicant email: ${safeApplicantEmail || 'N/A'}\n`;

  const html = buildBaseHtml({
    title: 'New vendor request',
    statusLabel: 'Review required',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Hi <strong>${safeAdminName}</strong>,</p>
      <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.65;">
        A new vendor verification request is waiting for your review. Please assess the submission and approve or reject it as appropriate.
      </p>

      <div style="background:#f8fafc;border-radius:14px;padding:16px 14px;border:1px solid #e2e8f0;">
        <div style="font-weight:700;color:#0f172a;margin:0 0 10px;">Submission details</div>
        ${buildInfoRow({ label: 'Business', value: safeVendorBusinessName })}
        ${buildInfoRow({ label: 'Applicant', value: safeApplicantName })}
        ${buildInfoRow({ label: 'Email', value: safeApplicantEmail || 'N/A' })}
      </div>

      <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
        Click below to open the admin dashboard and complete the review.
      </p>
    `,
    ctaText: 'Review request',
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
  const text = `Hi ${safeFirstName},\n\nYour booking has been confirmed.\nVendor: ${safeVendorName}\nService: ${safeServiceName}\nDate: ${safeBookingDate}\nTime: ${safeBookingTime}`;

  const html = buildBaseHtml({
    title: 'Booking confirmed',
    statusLabel: 'Confirmed',
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Hi <strong>${safeFirstName}</strong>,</p>
      <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.65;">Your booking request has been confirmed. Below are the details of your upcoming event.</p>

      <div style="background:#f8fafc;border-radius:14px;padding:16px 14px;border:1px solid #e2e8f0;">
        ${buildInfoRow({ label: 'Vendor', value: safeVendorName })}
        ${buildInfoRow({ label: 'Service', value: safeServiceName })}
        ${buildInfoRow({ label: 'Date', value: safeBookingDate || 'TBD' })}
        ${buildInfoRow({ label: 'Time', value: safeBookingTime || 'TBD' })}
      </div>

      <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.6;">If you need to update your reservation, please reach out to your vendor directly.</p>
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
      <div style="background:#ecfdf5;border-radius:14px;padding:18px 16px;margin:0 0 18px;border:1px solid #d1fae5;">
        <div style="font-weight:800;font-size:16px;color:#065f46;">Payment confirmed successfully ✅</div>
        <div style="margin-top:10px;color:#0f5132;font-size:14px;line-height:1.65;">We have received your payment and your booking is now fully secured.</div>
      </div>

      <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Hi <strong>${safeFirstName}</strong>,</p>
      <p style="margin:0 0 14px;color:#475569;font-size:13px;line-height:1.65;">Thank you for your payment. Here are the key details for your booking and receipt.</p>

      <div style="background:#f8fafc;border-radius:14px;padding:16px 14px;border:1px solid #e2e8f0;">
        ${buildInfoRow({ label: 'Booking ID', value: safeBookingId })}
        ${buildInfoRow({ label: 'Service', value: safeServiceName })}
        ${buildInfoRow({ label: 'Vendor', value: safeVendorName })}
        ${buildInfoRow({ label: 'Amount', value: safeAmount })}
        ${buildInfoRow({ label: 'Payment method', value: safePaymentMethod })}
        ${buildInfoRow({ label: 'Reference', value: safeTransactionReference })}
        ${buildInfoRow({ label: 'Booking date', value: safeBookingDate })}
      </div>

      <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.6;">You can review the booking details anytime using the button below.</p>
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
    title: 'New payment received',
    statusLabel: 'Payment received',
    bodyHtml: `
      <div style="background:#ecfdf5;border-radius:14px;padding:18px 16px;margin:0 0 18px;border:1px solid #d1fae5;">
        <div style="font-weight:800;font-size:16px;color:#065f46;">A payment just cleared ✅</div>
        <div style="margin-top:10px;color:#0f5132;font-size:14px;line-height:1.65;">A customer has successfully paid for one of your bookings. Review the details below and prepare to deliver great service.</div>
      </div>

      <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Hi <strong>${safeVendorName}</strong>,</p>
      <p style="margin:0 0 14px;color:#475569;font-size:13px;line-height:1.65;">Payment details for the booking are listed below.</p>
      <div style="background:#f8fafc;border-radius:14px;padding:16px 14px;border:1px solid #e2e8f0;">
        ${buildInfoRow({ label: 'Booking ID', value: safeBookingId })}
        ${buildInfoRow({ label: 'Service', value: safeServiceName })}
        ${buildInfoRow({ label: 'Customer', value: safeCustomerName })}
        ${buildInfoRow({ label: 'Amount', value: safeAmount })}
        ${buildInfoRow({ label: 'Payment method', value: safePaymentMethod })}
        ${buildInfoRow({ label: 'Reference', value: safeTransactionReference })}
        ${buildInfoRow({ label: 'Booking date', value: safeBookingDate })}
      </div>
      <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.6;">Open the booking to confirm details and be ready for the scheduled service.</p>
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
