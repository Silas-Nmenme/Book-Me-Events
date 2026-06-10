const asyncHandler = require('express-async-handler');

const Payment = require('../models/Payment');

exports.getPaymentsSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const year = now.getFullYear();

  const payments = await Payment.aggregate([
    {
      $match: {
        user: userId,
        paymentStatus: 'COMPLETED',
      },
    },
    {
      $addFields: {
        month: { $dateToString: { format: '%b', date: '$createdAt' } },
        monthNum: { $month: '$createdAt' },
      },
    },
    { $match: { $expr: { $eq: [{ $year: '$createdAt' }, year] } } },
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

  return res.status(200).json({ success: true, data: items, message: 'Payments summary fetched' });
});

