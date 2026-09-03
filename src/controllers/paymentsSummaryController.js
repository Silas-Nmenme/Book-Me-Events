const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

const Payment = require('../models/Payment');
const Vendor = require('../models/Vendor');

exports.getPaymentsSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const match = { paymentStatus: 'COMPLETED' };

  if (req.user.role === 'USER') {
    match.user = new mongoose.Types.ObjectId(req.user.id);
  } else if (req.user.role === 'VENDOR') {
    const vendor = await Vendor.findOne({ user: req.user.id }).select('_id');
    if (!vendor) {
      return res.status(200).json({ success: true, data: [], total: 0, message: 'Payments summary fetched' });
    }
    match.vendor = vendor._id;
  }

  const payments = await Payment.aggregate([
    {
      $match: {
        ...match,
        $expr: { $eq: [{ $year: '$createdAt' }, year] },
      },
    },
    {
      $addFields: {
        month: { $dateToString: { format: '%b', date: '$createdAt' } },
        monthNum: { $month: '$createdAt' },
      },
    },
    {
      $group: {
        _id: { month: '$month', monthNum: '$monthNum' },
        amount: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.monthNum': 1 } },
  ]);

  const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const map = new Map();
  payments.forEach((p) => map.set(p._id.month, p.amount));

  const items = monthOrder.map((m) => ({ month: m, amount: map.get(m) || 0 }));
  const total = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  return res.status(200).json({ success: true, data: items, total, message: 'Payments summary fetched' });
});

