const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    rating: { 
      type: Number, 
      required: true, 
      min: 1, 
      max: 5 
    },
    title: { type: String, required: true },
    comment: { type: String, required: true },
    isVerifiedPurchase: { type: Boolean, default: true },
    helpfulCount: { type: Number, default: 0 },
    unhelpfulCount: { type: Number, default: 0 },
    photos: [{ type: String }],
    vendorResponse: { type: String },
    vendorResponseDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
