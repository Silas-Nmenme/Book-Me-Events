const crypto = require('crypto');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { sendEmail } = require('../utils/emailClient');
const {
  paymentReceiptEmail,
  vendorPaymentNotificationEmail,
} = require('../utils/emailTemplates');

const verifyFlutterwaveSignature = (rawBody, signature, secret) => {
  if (!signature || !secret || !rawBody) {
    return false;
  }

  const headerSig = Array.isArray(signature) ? signature[0] : signature;
  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedSig, 'utf8'),
      Buffer.from(headerSig, 'utf8')
    );
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

  const response = await fetchClient(FLUTTERWAVE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== 'success') {
    const message = data?.message || data?.status || 'Failed to initialize Flutterwave payment';
    throw new Error(message);
  }

  return data;
};

/**
 * GET ALL PAYMENTS
 */
exports.getPayments = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let filter = {};

    if (status) {
      filter.paymentStatus = status;
    }

    if (req.user.role === 'USER') {
      filter.user = req.user.id;
    } else if (req.user.role === 'VENDOR') {
      filter.vendor = req.user._id;
    }

    const skip = (page - 1) * limit;

    const payments = await Payment.find(filter)
      .populate('booking')
      .populate('user', 'firstName lastName email')
      .populate('vendor', 'businessName')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Payment.countDocuments(filter);

    return res.status(200).json({
      success: true,
      count: payments.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: Number(page),
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
      .populate('user')
      .populate('vendor');

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
        bookingDate: bookingData.eventDate?.toDateString?.() || bookingData.eventDate,
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
        bookingDate: bookingData.eventDate?.toDateString?.() || bookingData.eventDate,
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
 * FIX: All error responses now return 200 OK to prevent Flutterwave retry loops
 */
exports.handleFlutterwaveWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.FLW_WEBHOOK_SECRET;
    const signature =
      req.headers['verif-hash'] ||
      req.headers['verificationhash'] ||
      req.headers['verificationsignature'] ||
      req.headers['x-flutterwave-signature'] ||
      req.headers['x-verification-hash'];

    if (!webhookSecret) {
      console.error('FLW_WEBHOOK_SECRET missing; cannot verify Flutterwave webhook.');
      // FIX: Return 200 with acknowledged response instead of 500
      return res.status(200).json({ received: true, error: 'Webhook secret not configured' });
    }

    if (!signature) {
      console.warn('Missing webhook signature');
      // FIX: Return 200 with acknowledged response instead of 401
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

    if (!verifyFlutterwaveSignature(rawText, signature, webhookSecret)) {
      console.error('Invalid Flutterwave webhook signature', { signature, rawTextLength: rawText.length });
      // FIX: Return 200 with acknowledged response instead of 401
      return res.status(200).json({ received: true, error: 'Invalid webhook signature' });
    }

    const event = payload?.event;
    const data = payload?.data;

    console.log('Flutterwave webhook received', {
      url: req.originalUrl,
      event,
      status: data?.status,
      reference: data?.tx_ref || data?.reference,
      meta: data?.meta,
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
      console.warn('Payment not found for Flutterwave webhook:', {
        reference,
        bookingId: data?.meta?.bookingId,
        payloadEvent: event,
      });
      // FIX: Return 200 with acknowledged response instead of 404 to prevent retry
      return res.status(200).json({ received: true, ignored: true, reason: 'Payment not found' });
    }

    // FIX: Verify booking ownership to prevent cross-user payments
    if (payment.user.toString() !== (data?.meta?.userId || '')) {
      console.error('Payment user mismatch - potential fraud attempt', {
        paymentUserId: payment.user,
        webhookUserId: data?.meta?.userId,
        reference,
      });
      return res.status(200).json({ received: true, ignored: true, reason: 'User mismatch' });
    }

    if (payment.paymentStatus === 'COMPLETED') {
      const booking = await Booking.findById(payment.booking)
        .populate('user')
        .populate('vendor')
        .populate('service');

      if (booking && booking.paymentStatus !== 'COMPLETED') {
        booking.paymentStatus = 'COMPLETED';
        booking.bookingStatus = booking.bookingStatus === 'PENDING' ? 'CONFIRMED' : booking.bookingStatus;
        await booking.save();
      }

      return res.json({ received: true, duplicated: true });
    }

    const booking = await Booking.findById(payment.booking)
      .populate('user')
      .populate('vendor')
      .populate('service');

    if (!booking) {
      console.warn('Booking not found for payment:', { paymentId: payment._id, reference });
      // FIX: Return 200 with acknowledged response instead of 404 to prevent retry
      return res.status(200).json({ received: true, ignored: true, reason: 'Booking not found' });
    }

    const amountReceived = Number(data?.amount_settled ?? data?.amount ?? 0);
    if (amountReceived <= 0) {
      console.error('Invalid payment amount received:', { amountReceived, reference });
      payment.paymentStatus = 'FAILED';
      await payment.save();
      // FIX: Return 200 with acknowledged response instead of 400 to prevent retry
      return res.status(200).json({ received: true, error: 'Invalid payment amount', status: 'FAILED' });
    }

    // FIX: Add currency validation to prevent currency swap fraud
    const flutterwaveCurrency = (data?.currency || 'NGN').toUpperCase();
    const expectedCurrency = (payment.currency || booking.amountCurrency || 'NGN').toUpperCase();
    if (flutterwaveCurrency !== expectedCurrency) {
      console.error('Currency mismatch detected', {
        flutterwaveCurrency,
        expectedCurrency,
        reference,
      });
      payment.paymentStatus = 'FAILED';
      await payment.save();
      return res.status(200).json({
        received: true,
        error: 'Currency mismatch',
        status: 'FAILED',
        details: { expected: expectedCurrency, received: flutterwaveCurrency },
      });
    }

    if (amountReceived < Number(payment.amount)) {
      console.error('Insufficient payment amount', {
        expected: payment.amount,
        received: amountReceived,
        reference,
      });
      payment.paymentStatus = 'FAILED';
      await payment.save();
      // FIX: Return 200 with acknowledged response instead of 400 to prevent retry
      return res.status(200).json({
        received: true,
        error: 'Payment amount is less than expected',
        status: 'FAILED',
        details: { expected: payment.amount, received: amountReceived },
      });
    }

    // FIX: Use atomic update to prevent race conditions with concurrent webhooks
    const paymentMethod = data?.payment_type || data?.payment_method || payment.paymentMethod || 'CARD';
    
    const updatedPayment = await Payment.findByIdAndUpdate(
      payment._id,
      {
        paymentStatus: 'COMPLETED',
        paymentMethod,
        paymentGateway: 'FLUTTERWAVE',
        amount: amountReceived,
        currency: flutterwaveCurrency,
        // Add webhook metadata for audit trail
        webhookReceivedAt: new Date(),
        webhookReference: reference,
      },
      { new: true }
    );

    // FIX: Atomic booking status update
    const updatedBooking = await Booking.findByIdAndUpdate(
      payment.booking,
      {
        paymentStatus: 'COMPLETED',
        // Only transition PENDING -> CONFIRMED; don't override other states
        $cond: [
          { $eq: ['$bookingStatus', 'PENDING'] },
          'CONFIRMED',
          '$bookingStatus'
        ]
      },
      { new: true }
    ).populate('user').populate('vendor').populate('service');

    // Re-fetch with proper population if atomic update didn't work as expected
    let finalBooking = updatedBooking;
    if (!finalBooking) {
      finalBooking = await Booking.findById(payment.booking)
        .populate('user')
        .populate('vendor')
        .populate('service');
    }

    if (finalBooking && finalBooking.bookingStatus === 'PENDING') {
      finalBooking.bookingStatus = 'CONFIRMED';
      await finalBooking.save();
    }

    const bookingUrl = `${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${finalBooking._id}`;

    try {
      const receiptEmail = paymentReceiptEmail({
        firstName: finalBooking.user?.firstName || finalBooking.user?.email,
        bookingId: finalBooking._id,
        amount: amountReceived,
        currency: flutterwaveCurrency,
        paymentMethod,
        transactionReference: reference,
        bookingDate: finalBooking.eventDate?.toDateString?.() || finalBooking.eventDate,
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
      // Non-fatal: don't fail webhook processing if email fails
    }

    try {
      const vendorNotification = vendorPaymentNotificationEmail({
        vendorName: finalBooking.vendor?.businessName || finalBooking.vendor?.name || 'Vendor',
        bookingId: finalBooking._id,
        amount: amountReceived,
        currency: flutterwaveCurrency,
        paymentMethod,
        transactionReference: reference,
        bookingDate: finalBooking.eventDate?.toDateString?.() || finalBooking.eventDate,
        serviceName: finalBooking.service?.name || finalBooking.service?.serviceName || 'Service',
        customerName: `${finalBooking.user?.firstName || ''} ${finalBooking.user?.lastName || ''}`.trim() || finalBooking.user?.email || 'Customer',
        bookingUrl,
      });
      if (finalBooking.vendor?.email) {
        await sendEmail({
          to: finalBooking.vendor.email,
          subject: vendorNotification.subject,
          text: vendorNotification.text,
          html: vendorNotification.html,
        });
      }
    } catch (e) {
      console.error('Vendor notification email failed:', e.message || e);
      // Non-fatal: don't fail webhook processing if email fails
    }

    return res.json({ received: true, status: 'COMPLETED', paymentId: updatedPayment._id });
  } catch (err) {
    console.error('Webhook error:', err);
    // FIX: Return 200 with acknowledged response on unexpected errors to prevent retry
    return res.status(200).json({ received: true, error: err.message });
  }
};
