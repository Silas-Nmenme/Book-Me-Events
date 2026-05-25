const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { sendEmail } = require('../utils/emailClient');
const {
  paymentReceiptEmail,
  vendorPaymentNotificationEmail,
} = require('../utils/emailTemplates');
const Flutterwave = require('flutterwave-node-v3');

const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY
);

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
        bookingUrl: `${process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${bookingData._id}`,
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
        bookingUrl: `${process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${bookingData._id}`,
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

    const payload = {
      tx_ref: `BOOK_${booking._id}_${Date.now()}`,
      amount,
      currency,
      payment_options: 'card, mobilemoney, ussd',
      redirect_url: `${process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${booking._id}`,
      meta: {
        bookingId: booking._id.toString(),
        userId: req.user.id,
        serviceName: booking.service?.name || 'Booking',
      },
      customer: {
        email: userEmail,
        name: userName,
      },
      customizations: {
        title: 'Book Me Events Payment',
        description: `Payment for ${booking.service?.name || 'Service'}`,
        logo: 'https://bookmeevent.netlify.app/logo.png',
      },
    };

    const response = await flw.Payment.initiate(payload);

    if (response.status === 'success') {
      return res.status(200).json({
        success: true,
        link: response.data.link,
        authorization_url: response.data.authorization_url,
        access_code: response.data.access_code,
        reference: response.data.reference,
      });
    }

    return res.status(400).json({
      success: false,
      message: response.message || 'Failed to initialize payment',
    });
  } catch (err) {
    console.error('Flutterwave payment error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * FLUTTERWAVE WEBHOOK
 */
exports.flutterwaveWebhook = async (req, res) => {
  try {
    const secretHash = process.env.FLW_WEBHOOK_SECRET;
    const signature = req.headers['verificationhash'];

    if (signature !== secretHash) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const payload = req.body;

    if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
      const reference = payload.data.tx_ref;
      const amount = payload.data.amount_settled;
      const bookingId = payload.data.meta?.bookingId;
      const paymentMethod = payload.data.payment_type || 'CARD';

      try {
        const booking = await Booking.findById(bookingId)
          .populate('user')
          .populate('vendor')
          .populate('service');

        if (booking) {
          const payment = await Payment.create({
            booking: booking._id,
            user: booking.user,
            vendor: booking.vendor,
            amount,
            paymentMethod,
            transactionReference: reference,
            paymentGateway: 'FLUTTERWAVE',
            paymentStatus: 'COMPLETED',
          });

          booking.paymentStatus = 'COMPLETED';
          booking.bookingStatus = booking.bookingStatus === 'PENDING' ? 'CONFIRMED' : booking.bookingStatus;
          await booking.save();

          try {
            const receiptEmail = paymentReceiptEmail({
              firstName: booking.user?.firstName || booking.user?.email,
              bookingId: booking._id,
              amount,
              currency: booking.amountCurrency || 'NGN',
              paymentMethod,
              transactionReference: reference,
              bookingDate: booking.eventDate?.toDateString?.() || booking.eventDate,
              serviceName: booking.service?.name || booking.service?.serviceName || 'Service',
              vendorName: booking.vendor?.businessName || booking.vendor?.name || 'Vendor',
              bookingUrl: `${process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${booking._id}`,
            });
            if (booking.user?.email) {
              await sendEmail({
                to: booking.user.email,
                subject: receiptEmail.subject,
                text: receiptEmail.text,
                html: receiptEmail.html,
              });
            }
          } catch (e) {
            console.error('Payment receipt email failed:', e.message);
          }

          try {
            const vendorNotification = vendorPaymentNotificationEmail({
              vendorName: booking.vendor?.businessName || booking.vendor?.name || 'Vendor',
              bookingId: booking._id,
              amount,
              currency: booking.amountCurrency || 'NGN',
              paymentMethod,
              transactionReference: reference,
              bookingDate: booking.eventDate?.toDateString?.() || booking.eventDate,
              serviceName: booking.service?.name || booking.service?.serviceName || 'Service',
              customerName: `${booking.user?.firstName || ''} ${booking.user?.lastName || ''}`.trim() || booking.user?.email || 'Customer',
              bookingUrl: `${process.env.CLIENT_URL || ''}/Frontend/pages/bookings.html?bookingId=${booking._id}`,
            });
            if (booking.vendor?.email) {
              await sendEmail({
                to: booking.vendor.email,
                subject: vendorNotification.subject,
                text: vendorNotification.text,
                html: vendorNotification.html,
              });
            }
          } catch (e) {
            console.error('Vendor notification email failed:', e.message);
          }
        }
      } catch (e) {
        console.error('Webhook processing failed:', e.message);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};