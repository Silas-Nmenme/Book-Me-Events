const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

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