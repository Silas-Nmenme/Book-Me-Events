const crypto = require('crypto');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { sendEmail } = require('../utils/emailClient');
const {
  paymentReceiptEmail,
  vendorPaymentNotificationEmail,
} = require('../utils/emailTemplates');
const { validatePositiveNumber, validateMongoId } = require('../utils/inputValidator');
const { isResourceOwner } = require('../utils/authorizationHelper');

const verifyFlutterwaveSignature = (rawBody, headerName, signature, secret) => {
  if (!signature || !secret || !rawBody || !headerName) {
    return false;
  }

  const headerSig = Array.isArray(signature) ? signature[0] : signature;
  if (typeof headerSig !== 'string' || !headerSig) {
    return false;
  }

  try {
    const normalizedName = (headerName || '').toLowerCase();

    if (normalizedName === 'verif-hash' || normalizedName === 'x-verification-hash') {
      const expected = Buffer.from(secret, 'utf8');
      const actual = Buffer.from(headerSig, 'utf8');
      if (expected.length !== actual.length) {
        return false;
      }
      return crypto.timingSafeEqual(expected, actual);
    }

    if (normalizedName === 'flutterwave-signature' || normalizedName === 'x-flutterwave-signature') {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('base64');
      const actual = Buffer.from(headerSig, 'utf8');
      const computed = Buffer.from(expected, 'utf8');
      if (computed.length !== actual.length) {
        return false;
      }
      return crypto.timingSafeEqual(computed, actual);
    }

    return false;
  } catch {
    return false;
  }
};

const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3/payments';

const initiateFlutterwavePaymentRequest = async (payload) => {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    throw new Error('FLW_SECRET_KEY is not configured');
  }

  const fetchClient = typeof fetch === 'function' ? fetch : globalThis?.fetch;
  if (!fetchClient) {
    throw new Error('Fetch API not available on this server environment. Use Node 18+ or install a fetch polyfill.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetchClient(FLUTTERWAVE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || data?.status !== 'success') {
      const message = data?.message || data?.status || 'Failed to initialize Flutterwave payment';
      throw new Error(message);
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Flutterwave timed out while preparing checkout. Please try again in a moment.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const FLUTTERWAVE_VERIFY_BY_REF_URL = 'https://api.flutterwave.com/v3/transactions/verify_by_reference';

// Maps Flutterwave's free-form `payment_type` values to our Payment schema's enum.
const normalizeFlutterwavePaymentMethod = (rawType) => {
  const t = (rawType || '').toString().toLowerCase();
  if (!t) return null;
  if (t.includes('card')) return 'CARD';
  if (t.includes('ussd')) return 'USSD';
  if (t.includes('transfer') || t.includes('bank')) return 'BANK_TRANSFER';
  if (t.includes('wallet') || t.includes('mobilemoney') || t.includes('mpesa')) return 'WALLET';
  return null;
};

/**
 * Actively confirms a transaction with Flutterwave (used as a fallback when the
 * webhook is delayed, misconfigured, or never arrives).
 */
const verifyFlutterwaveTransactionByReference = async (txRef) => {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    throw new Error('FLW_SECRET_KEY is not configured');
  }

  const fetchClient = typeof fetch === 'function' ? fetch : globalThis?.fetch;
  if (!fetchClient) {
    throw new Error('Fetch API not available on this server environment. Use Node 18+ or install a fetch polyfill.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetchClient(`${FLUTTERWAVE_VERIFY_BY_REF_URL}?tx_ref=${encodeURIComponent(txRef)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || data?.status !== 'success') {
      const message = data?.message || 'Failed to verify Flutterwave transaction';
      throw new Error(message);
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Flutterwave verification timed out. Please try again in a moment.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Applies a Flutterwave-confirmed charge to the Payment + Booking records.
 * Shared by both the webhook handler and the verify-on-return fallback endpoint
 * so the two paths can never disagree on validation/update logic.
 */
const applyConfirmedFlutterwaveCharge = async (payment, data) => {
  if (payment.paymentStatus === 'COMPLETED') {
    return { status: 'duplicate', payment };
  }

  const booking = await Booking.findById(payment.booking)
    .populate('user')
    .populate({ path: 'vendor', populate: { path: 'user', select: 'firstName lastName email' } })
    .populate('service');

  if (!booking) {
    return { status: 'booking_not_found' };
  }

  // Flutterwave charges the customer `amount`; `amount_settled` is net of their
  // processing fees and can legitimately be lower, so it must never be used to
  // reject an otherwise valid, fully-paid transaction.
  const amountReceived = Number(data?.amount ?? data?.amount_settled ?? 0);
  if (amountReceived <= 0) {
    payment.paymentStatus = 'FAILED';
    await payment.save();
    return { status: 'invalid_amount', amountReceived };
  }

  const flutterwaveCurrency = (data?.currency || 'NGN').toUpperCase();
  const expectedCurrency = (payment.currency || booking.amountCurrency || 'NGN').toUpperCase();
  if (flutterwaveCurrency !== expectedCurrency) {
    payment.paymentStatus = 'FAILED';
    await payment.save();
    return { status: 'currency_mismatch', expectedCurrency, flutterwaveCurrency };
  }

  if (amountReceived < Number(payment.amount)) {
    payment.paymentStatus = 'FAILED';
    await payment.save();
    return { status: 'insufficient_amount', expected: payment.amount, received: amountReceived };
  }

  const paymentMethod = normalizeFlutterwavePaymentMethod(data?.payment_type || data?.payment_method) || payment.paymentMethod || 'CARD';
  const reference = data?.tx_ref || data?.reference || payment.transactionReference;

  const updatedPayment = await Payment.findByIdAndUpdate(
    payment._id,
    {
      paymentStatus: 'COMPLETED',
      paymentMethod,
      paymentGateway: 'FLUTTERWAVE',
      amount: amountReceived,
      currency: flutterwaveCurrency,
      webhookReceivedAt: new Date(),
      webhookReference: reference,
    },
    { new: true }
  );

  // Only auto-confirm bookings still PENDING; leave any other state untouched.
  const nextBookingStatus = booking.bookingStatus === 'PENDING' ? 'CONFIRMED' : booking.bookingStatus;
  const updatedBooking = await Booking.findByIdAndUpdate(
    payment.booking,
    { paymentStatus: 'COMPLETED', bookingStatus: nextBookingStatus },
    { new: true }
  )
    .populate('user')
    .populate({ path: 'vendor', populate: { path: 'user', select: 'firstName lastName email' } })
    .populate('service');

  const finalBooking = updatedBooking || booking;
  const bookingUrl = `${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${finalBooking._id}`;

  try {
    const receiptEmail = paymentReceiptEmail({
      firstName: finalBooking.user?.firstName || finalBooking.user?.email,
      bookingId: finalBooking._id,
      amount: amountReceived,
      currency: flutterwaveCurrency,
      paymentMethod,
      transactionReference: reference,
      bookingDate: finalBooking.eventDate,
      serviceName: finalBooking.service?.name || finalBooking.service?.serviceName || 'Service',
      vendorName: finalBooking.vendor?.businessName || finalBooking.vendor?.name || 'Vendor',
      bookingUrl,
    });
    if (finalBooking.user?.email) {
      await sendEmail({
        to: finalBooking.user.email,
        subject: receiptEmail.subject,
        text: receiptEmail.text,
        html: receiptEmail.html,
      });
    }
  } catch (e) {
    console.error('Payment receipt email failed:', e.message || e);
  }

  try {
    const vendorNotification = vendorPaymentNotificationEmail({
      vendorName: finalBooking.vendor?.businessName || finalBooking.vendor?.name || 'Vendor',
      bookingId: finalBooking._id,
      amount: amountReceived,
      currency: flutterwaveCurrency,
      paymentMethod,
      transactionReference: reference,
      bookingDate: finalBooking.eventDate,
      serviceName: finalBooking.service?.name || finalBooking.service?.serviceName || 'Service',
      customerName: `${finalBooking.user?.firstName || ''} ${finalBooking.user?.lastName || ''}`.trim() || finalBooking.user?.email || 'Customer',
      bookingUrl,
    });
    if (finalBooking.vendor?.user?.email) {
      await sendEmail({
        to: finalBooking.vendor.user.email,
        subject: vendorNotification.subject,
        text: vendorNotification.text,
        html: vendorNotification.html,
      });
    }
  } catch (e) {
    console.error('Vendor notification email failed:', e.message || e);
  }

  return { status: 'completed', payment: updatedPayment, booking: finalBooking };
};

/**
 * GET ALL PAYMENTS
 */
exports.getPayments = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    // Validate pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 10), 50); // Max 50 per page

    let filter = {};

    if (status) {
      const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
      if (validStatuses.includes(status.toUpperCase())) {
        filter.paymentStatus = status.toUpperCase();
      }
    }

    // Authorization: USER sees only own payments, VENDOR sees their vendor payments, ADMIN sees all
    if (req.user.role === 'USER') {
      filter.user = req.user.id;
    } else if (req.user.role === 'VENDOR') {
      filter.vendor = req.user._id;
    }
    // ADMIN has no filter restriction

    const skip = (pageNum - 1) * limitNum;

    const payments = await Payment.find(filter)
      .populate('booking')
      .populate('user', 'firstName lastName email')
      .populate('vendor', 'businessName')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await Payment.countDocuments(filter);

    return res.status(200).json({
      success: true,
      count: payments.length,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: payments
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET SINGLE PAYMENT
 */
exports.getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('booking')
      .populate('user')
      .populate('vendor');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Enforce access control: USER can only read their own payments;
    // VENDOR can only read payments tied to their vendor profile;
    // ADMIN can read all.
    if (req.user.role !== 'ADMIN') {
      const isOwner = payment.user && payment.user._id && payment.user._id.toString() === req.user.id;
      const isVendorOwner = payment.vendor && payment.vendor._id && payment.vendor._id.toString() === req.user.id;

      if (!isOwner && !isVendorOwner) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this payment'
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: payment
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * CREATE PAYMENT
 */
exports.createPayment = async (req, res) => {
  try {
    const {
      booking,
      paymentMethod,
      transactionReference,
      paymentGateway
    } = req.body;

    const bookingData = await Booking.findById(booking)
      .populate('user', 'firstName lastName email')
      .populate({ path: 'vendor', populate: { path: 'user', select: 'firstName lastName email' } })
      .populate('service');

    if (!bookingData) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (bookingData.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to make payment for this booking'
      });
    }

    const payment = await Payment.create({
      booking,
      user: req.user.id,
      vendor: bookingData.vendor._id,
      amount: bookingData.totalAmount,
      paymentMethod,
      transactionReference,
      paymentGateway,
      paymentStatus: 'COMPLETED'
    });

    await Booking.findByIdAndUpdate(booking, {
      paymentStatus: 'COMPLETED'
    });

    try {
      const receiptEmail = paymentReceiptEmail({
        firstName: bookingData.user.firstName || bookingData.user.email,
        bookingId: bookingData._id,
        amount: bookingData.totalAmount,
        currency: bookingData.amountCurrency || 'NGN',
        paymentMethod,
        transactionReference,
        bookingDate: bookingData.eventDate,
        serviceName: bookingData.service?.name || bookingData.service?.serviceName || 'Service',
        vendorName: bookingData.vendor?.businessName || bookingData.vendor?.name || 'Vendor',
        bookingUrl: `${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${bookingData._id}`,
      });
      await sendEmail({
        to: bookingData.user.email,
        subject: receiptEmail.subject,
        text: receiptEmail.text,
        html: receiptEmail.html,
      });
    } catch (e) {
      console.error('Payment receipt email failed:', e.message);
    }

    try {
      const vendorNotification = vendorPaymentNotificationEmail({
        vendorName: bookingData.vendor?.businessName || bookingData.vendor?.name || 'Vendor',
        bookingId: bookingData._id,
        amount: bookingData.totalAmount,
        currency: bookingData.amountCurrency || 'NGN',
        paymentMethod,
        transactionReference,
        bookingDate: bookingData.eventDate,
        serviceName: bookingData.service?.name || bookingData.service?.serviceName || 'Service',
        customerName: `${bookingData.user?.firstName || ''} ${bookingData.user?.lastName || ''}`.trim() || bookingData.user?.email || 'Customer',
        bookingUrl: `${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${bookingData._id}`,
      });
      await sendEmail({
        to: bookingData.vendor.email,
        subject: vendorNotification.subject,
        text: vendorNotification.text,
        html: vendorNotification.html,
      });
    } catch (e) {
      console.error('Vendor payment notification email failed:', e.message);
    }

    // Activity for user
    const { logActivity } = require('../utils/activityLog');
    await logActivity({
      userId: req.user.id,
      actorId: req.user.id,
      actionType: 'PAYMENT_COMPLETED',
      entityType: 'PAYMENT',
      entityId: payment._id,
      metadata: { booking: payment.booking?.toString?.() || payment.booking },
      severity: 'SUCCESS',
    });

    return res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      data: payment
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET PAYMENT BY REFERENCE
 */
exports.getPaymentByRef = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      transactionReference: req.params.ref
    })
      .populate('booking')
      .populate('user')
      .populate('vendor');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: payment
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * REFUND PAYMENT
 */
exports.refundPayment = async (req, res) => {
  try {
    const { refundReason } = req.body;

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (
      payment.user.toString() !== req.user.id &&
      payment.vendor.toString() !== req.user._id &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to refund this payment'
      });
    }

    payment.paymentStatus = 'REFUNDED';
    payment.refundAmount = payment.amount;

    const { logActivity } = require('../utils/activityLog');
    await logActivity({
      userId: payment.user.toString(),
      actorId: req.user.id,
      actionType: 'PAYMENT_REFUNDED',
      entityType: 'PAYMENT',
      entityId: payment._id,
      metadata: { booking: payment.booking },
      severity: 'WARN',
    });
    payment.refundReason = refundReason;
    payment.refundDate = new Date();

    await payment.save();

    await Booking.findByIdAndUpdate(payment.booking, {
      paymentStatus: 'REFUNDED'
    });

    return res.status(200).json({
      success: true,
      message: 'Payment refunded successfully',
      data: payment
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * PAYMENT STATS
 */
exports.getPaymentStats = async (req, res) => {
  try {
    const totalRevenue = await Payment.aggregate([
      { $match: { paymentStatus: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const paymentsByMethod = await Payment.aggregate([
      { $match: { paymentStatus: 'COMPLETED' } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);

    const pendingAmount = await Payment.aggregate([
      { $match: { paymentStatus: 'PENDING' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue: totalRevenue[0]?.total || 0,
        paymentsByMethod,
        pendingAmount: pendingAmount[0]?.total || 0
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * CREATE FLUTTERWAVE PAYMENT LINK
 */
exports.createFlutterwavePayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId)
      .populate('user')
      .populate('vendor')
      .populate('service');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const bookingUserId = booking.user?._id ? booking.user._id.toString() : booking.user?.toString();
    if (bookingUserId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const amount = booking.totalAmount || 0;
    const currency = booking.amountCurrency || 'NGN';
    const userEmail = booking.user.email || 'noemail@example.com';
    const userName = `${booking.user.firstName || ''} ${booking.user.lastName || ''}`.trim() || booking.user.email;
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://bookmeevent.netlify.app';

    if (!process.env.FLW_SECRET_KEY) {
      console.error('Flutterwave secret key missing: FLW_SECRET_KEY');
      return res.status(500).json({ success: false, message: 'Payment provider not configured' });
    }

    const redirectUrl = `${frontendUrl}/pages/bookings.html?bookingId=${booking._id}`;

    // FIX: Generate unique transaction reference for each initialization attempt
    // This allows users to retry failed payments without unique constraint violations
    const tx_ref = `BOOK_${booking._id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    let payment = await Payment.findOne({ booking: booking._id, paymentStatus: 'PENDING', paymentGateway: 'FLUTTERWAVE' });

    if (!payment) {
      // Create new PENDING payment
      payment = await Payment.create({
        booking: booking._id,

      user: req.user.id,
      vendor: booking.vendor._id,
      amount,
      currency,
      paymentMethod: 'CARD',
      transactionReference: tx_ref,
      paymentGateway: 'FLUTTERWAVE',
      paymentStatus: 'PENDING',
      // FIX: Add initialization timestamp for audit trail
      initializedAt: new Date(),
    });
  } else {
    // FIX: Update existing PENDING payment with new transaction reference
    // This handles retry scenarios where user clicks "Pay again"
    payment = await Payment.findByIdAndUpdate(
      payment._id,
      {
        transactionReference: tx_ref,
        initializedAt: new Date(),
      },
      { new: true }
    );
  }

    await Booking.findByIdAndUpdate(bookingId, { paymentStatus: 'PENDING' });


    const payload = {
      tx_ref,
      amount,
      currency,
      payment_options: 'card, mobilemoney, ussd',
      redirect_url: redirectUrl,
      meta: {
        bookingId: booking._id.toString(),
        userId: req.user.id,
        serviceName: booking.service?.name || 'Booking',
      },
      customer: {
        email: userEmail,
        phonenumber: booking.user.phone || booking.user.phoneNumber || '',
        name: userName,
      },
      customizations: {
        title: 'Book Me Events Payment',
        description: `Payment for ${booking.service?.name || 'Service'}`,
        logo: 'https://bookmeevent.netlify.app/logo.png',
      },
    };

    const response = await initiateFlutterwavePaymentRequest(payload);

    return res.status(200).json({
      success: true,
      link: response.data.link,
      authorization_url: response.data.authorization_url,
      access_code: response.data.access_code,
      reference: response.data.reference,
      tx_ref,
      paymentId: payment._id,
    });
  } catch (err) {
    console.error('Flutterwave payment error:', err?.message || err);
    return res.status(500).json({ success: false, message: err?.message || 'Internal server error' });
  }
};

/**
 * FLUTTERWAVE WEBHOOK
 * All error responses return 200 OK to prevent Flutterwave retry loops.
 */
exports.handleFlutterwaveWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.FLW_WEBHOOK_SECRET;
    const signatureHeaderName = req.headers['verif-hash'] || req.headers['x-verification-hash']
      ? 'verif-hash'
      : (req.headers['flutterwave-signature'] || req.headers['x-flutterwave-signature'])
        ? 'flutterwave-signature'
        : null;
    const signature = req.headers['verif-hash'] || req.headers['x-verification-hash'] || req.headers['flutterwave-signature'] || req.headers['x-flutterwave-signature'];

    if (!webhookSecret) {
      console.error('FLW_WEBHOOK_SECRET missing; cannot verify Flutterwave webhook.');
      return res.status(200).json({ received: true, error: 'Webhook secret not configured' });
    }

    if (!signatureHeaderName || !signature) {
      console.warn('Missing webhook signature', { signatureHeaderName });
      return res.status(200).json({ received: true, error: 'Missing webhook signature' });
    }

    let rawBody = req.body;
    let payload = rawBody;
    let rawText = '';

    if (Buffer.isBuffer(rawBody)) {
      rawText = rawBody.toString('utf8');
      payload = JSON.parse(rawText);
    } else if (typeof rawBody === 'string' && rawBody.length) {
      rawText = rawBody;
      payload = JSON.parse(rawText);
    } else if (typeof rawBody === 'object' && rawBody !== null) {
      rawText = JSON.stringify(rawBody);
    }

    if (!verifyFlutterwaveSignature(rawText, signatureHeaderName, signature, webhookSecret)) {
      console.error('Invalid Flutterwave webhook signature', { signatureHeaderName, rawTextLength: rawText.length });
      return res.status(200).json({ received: true, error: 'Invalid webhook signature' });
    }

    const event = payload?.event;
    const data = payload?.data;

    console.log('Flutterwave webhook received', {
      event,
      status: data?.status,
      reference: data?.tx_ref || data?.reference,
    });

    const allowedStatus = ['successful', 'success', 'completed'];
    if (event !== 'charge.completed' || !allowedStatus.includes((data?.status || '').toString().toLowerCase())) {
      return res.json({ received: true, ignored: true });
    }

    const reference = data?.tx_ref || data?.reference;
    let payment = null;

    if (reference) {
      payment = await Payment.findOne({ transactionReference: reference });
    }
    if (!payment && data?.meta?.bookingId) {
      payment = await Payment.findOne({ booking: data.meta.bookingId, paymentGateway: 'FLUTTERWAVE' });
    }

    if (!payment) {
      console.warn('Payment not found for Flutterwave webhook:', { reference, bookingId: data?.meta?.bookingId });
      return res.status(200).json({ received: true, ignored: true, reason: 'Payment not found' });
    }

    // NOTE: We intentionally do NOT reject on a missing/mismatched `data.meta.userId`.
    // Flutterwave does not reliably echo back custom `meta` for every payment method
    // (bank transfer/USSD/mobile money frequently omit it), and doing so previously
    // caused legitimate payments to be silently ignored, leaving them stuck PENDING.
    // The unguessable `transactionReference` lookup above, combined with the verified
    // webhook signature, is sufficient proof this event belongs to this payment.

    const result = await applyConfirmedFlutterwaveCharge(payment, data);

    if (result.status === 'duplicate') {
      return res.json({ received: true, duplicated: true });
    }
    if (result.status === 'booking_not_found') {
      console.warn('Booking not found for payment:', { paymentId: payment._id, reference });
      return res.status(200).json({ received: true, ignored: true, reason: 'Booking not found' });
    }
    if (result.status === 'invalid_amount') {
      console.error('Invalid payment amount received:', { amountReceived: result.amountReceived, reference });
      return res.status(200).json({ received: true, error: 'Invalid payment amount', status: 'FAILED' });
    }
    if (result.status === 'currency_mismatch') {
      console.error('Currency mismatch detected', { ...result, reference });
      return res.status(200).json({ received: true, error: 'Currency mismatch', status: 'FAILED', details: result });
    }
    if (result.status === 'insufficient_amount') {
      console.error('Insufficient payment amount', { ...result, reference });
      return res.status(200).json({ received: true, error: 'Payment amount is less than expected', status: 'FAILED', details: result });
    }

    return res.json({ received: true, status: 'COMPLETED', paymentId: result.payment._id });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
};

/**
 * VERIFY PAYMENT ON RETURN (fallback for delayed/missing webhooks)
 * Called by the frontend when the user is redirected back from Flutterwave
 * checkout, so payment confirmation never solely depends on webhook delivery.
 */
exports.verifyFlutterwavePayment = async (req, res) => {
  try {
    const { reference } = req.params;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'reference is required' });
    }

    const payment = await Payment.findOne({ transactionReference: reference });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to verify this payment' });
    }

    if (payment.paymentStatus === 'COMPLETED') {
      return res.status(200).json({ success: true, data: payment, message: 'Payment already confirmed' });
    }

    const verification = await verifyFlutterwaveTransactionByReference(reference);
    const data = verification?.data;

    const allowedStatus = ['successful', 'success', 'completed'];
    if (!allowedStatus.includes((data?.status || '').toString().toLowerCase())) {
      return res.status(200).json({
        success: true,
        data: payment,
        message: `Transaction status: ${data?.status || 'unknown'}`,
      });
    }

    const result = await applyConfirmedFlutterwaveCharge(payment, data);

    if (result.status === 'completed' || result.status === 'duplicate') {
      const latestPayment = await Payment.findById(payment._id);
      return res.status(200).json({ success: true, data: latestPayment, message: 'Payment confirmed' });
    }

    const latestPayment = await Payment.findById(payment._id);
    return res.status(200).json({
      success: false,
      data: latestPayment,
      message: `Verification failed: ${result.status}`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
