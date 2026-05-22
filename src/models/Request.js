const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    eventDate: { type: Date, required: true },
    eventLocation: { type: String, required: true },
    eventDescription: { type: String, required: true },
    guestCount: { type: Number },
    budgetAmount: { type: Number },
    budgetCurrency: { type: String, default: 'NGN' },
    status: { 
      type: String, 
      enum: ['PENDING', 'ACCEPTED', 'BOOKED', 'DECLINED', 'COMPLETED', 'CANCELLED'], 
      default: 'PENDING' 
    },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    notes: { type: String },
    responseDeadline: { type: Date },
  },

  { timestamps: true }
);

module.exports = mongoose.model('Request', requestSchema);
