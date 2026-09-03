const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },
    paymentMethod: { 
      type: String, 
      enum: ['BANK_TRANSFER', 'CARD', 'WALLET', 'USSD'], 
      required: true 
    },
    transactionReference: { type: String, unique: true, required: true },
    paymentStatus: { 
      type: String, 
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'], 
      default: 'PENDING' 
    },
    paymentGateway: { type: String },
    receiptUrl: { type: String },
    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String },
    refundDate: { type: Date },

    // Flutterwave checkout/audit trail
    initializedAt: { type: Date },
    webhookReceivedAt: { type: Date },
    webhookReference: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
