const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    eventDate: { type: Date, required: true },
    eventLocation: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    amountCurrency: { type: String, default: 'NGN' },
    paymentStatus: { 
      type: String, 
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'], 
      default: 'PENDING' 
    },
    bookingStatus: { 
      type: String, 
      enum: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], 
      default: 'CONFIRMED' 
    },
    specialRequests: { type: String },
    cancellationReason: { type: String },
    cancellationDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
