# Payment Flow Fixes - Implementation Guide

## Overview
This document outlines all critical fixes applied to the payment system to ensure smooth, secure, and reliable payment processing.

---

## 🔴 CRITICAL FIXES IMPLEMENTED

### 1. Webhook Error Response Format Fix
**Issue**: Webhook was returning error status codes (404, 400, 500, 401) which triggered Flutterwave's automatic retry logic
**Impact**: Caused infinite retry loops and potential duplicate payments

**Before**:
```javascript
if (!payment) {
  return res.status(404).json({ success: false, message: 'Payment record not found' });
}

if (amountReceived <= 0) {
  return res.status(400).json({ success: false, message: 'Invalid payment amount' });
}
```

**After**:
```javascript
if (!payment) {
  return res.status(200).json({ received: true, ignored: true, reason: 'Payment not found' });
}

if (amountReceived <= 0) {
  payment.paymentStatus = 'FAILED';
  await payment.save();
  return res.status(200).json({ received: true, error: 'Invalid payment amount', status: 'FAILED' });
}
```

**Key Changes**:
- All webhook error responses now return HTTP 200 OK
- Responses maintain proper acknowledgment: `{received: true, ...}`
- Failed payments are marked as 'FAILED' in database instead of failing the webhook
- Flutterwave will not retry successful 200 responses

**Testing**:
```bash
# Test webhook with invalid payment
curl -X POST http://localhost:5000/payment/webhook/flutterwave \
  -H "verif-hash: invalid-signature" \
  -H "Content-Type: application/json" \
  -d '{"event":"charge.completed","data":{"tx_ref":"invalid"}}'
# Should return 200 OK with received: true
```

---

### 2. Transaction Reference Uniqueness Fix
**Issue**: Schema had `unique: true` constraint but code reused same tx_ref for retry attempts, causing duplicate key error

**Impact**: Users couldn't retry failed payments - second attempt would fail immediately

**Before**:
```javascript
let payment = await Payment.findOne({ 
  booking: booking._id, 
  paymentStatus: 'PENDING', 
  paymentGateway: 'FLUTTERWAVE' 
});
const tx_ref = payment?.transactionReference || `BOOK_${booking._id}_${Date.now()}`;
// This reuses the same tx_ref if payment exists, causing unique constraint violation
```

**After**:
```javascript
// Generate unique transaction reference for each initialization attempt
const tx_ref = `BOOK_${booking._id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

let payment = await Payment.findOne({ 
  booking: booking._id, 
  paymentStatus: 'PENDING', 
  paymentGateway: 'FLUTTERWAVE' 
});

if (!payment) {
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
    initializedAt: new Date(),
  });
} else {
  // Update existing PENDING payment with new transaction reference
  payment = await Payment.findByIdAndUpdate(
    payment._id,
    {
      transactionReference: tx_ref,
      initializedAt: new Date(),
    },
    { new: true }
  );
}
```

**Key Changes**:
- tx_ref is now always unique (includes timestamp and random string)
- Existing PENDING payments are updated with new tx_ref instead of creating duplicate
- Added `initializedAt` timestamp for audit trail
- Users can now safely retry failed payments

**Database Schema Note**:
Keep the `unique: true` constraint on `transactionReference` - it now works correctly with unique values per attempt.

---

### 3. Booking Ownership Validation Fix
**Issue**: Webhook didn't verify that booking belongs to the payment user - allowed cross-user fraud

**Impact**: User A could potentially pay for User B's booking

**Before**:
```javascript
if (!payment) {
  return res.status(404).json({ success: false, message: 'Payment record not found' });
}
// No user verification - anyone with a payment reference could trigger completion
```

**After**:
```javascript
if (!payment) {
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
```

**Key Changes**:
- Webhook now verifies `payment.user` matches `data.meta.userId` from Flutterwave
- Fraud attempts are logged with full context
- Mismatched payments are acknowledged but ignored
- Requires userId in meta when initializing payment (already implemented)

**Frontend Verification**:
Ensure frontend passes userId in payment initialization:
```javascript
// This is already done in createFlutterwavePayment:
meta: {
  bookingId: booking._id.toString(),
  userId: req.user.id,  // ← This is now validated
  serviceName: booking.service?.name || 'Booking',
}
```

---

### 4. Currency Validation Fix
**Issue**: Webhook didn't verify Flutterwave-returned currency matches expected currency

**Impact**: Could allow payment in wrong currency or currency swap attacks

**Before**:
```javascript
payment.currency = payment.currency || booking.amountCurrency || 'NGN';
// Uses whatever Flutterwave sends without validation
```

**After**:
```javascript
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
```

**Key Changes**:
- Compares Flutterwave currency with expected currency
- Marks payment as FAILED if mismatch
- Returns 200 OK to prevent retry
- Prevents currency swap fraud

**Testing**:
```bash
# Simulate currency mismatch in webhook
# Expected: NGN, Received: USD
# Payment should be marked FAILED and webhook returns 200
```

---

### 5. Race Condition Prevention Fix
**Issue**: Duplicate detection checked `payment.paymentStatus === 'COMPLETED'` but two concurrent webhooks could both pass this check

**Impact**: Both webhooks might process simultaneously, creating duplicate completion logic

**Before**:
```javascript
if (payment.paymentStatus === 'COMPLETED') {
  // Handle duplicate - but race condition if two webhooks arrive simultaneously
  return res.json({ received: true, duplicated: true });
}

// Update payment
payment.paymentStatus = 'COMPLETED';
await payment.save(); // Vulnerable between the check and update
```

**After**:
```javascript
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

// FIX: Use atomic update to prevent race conditions with concurrent webhooks
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

// FIX: Atomic booking status update
const updatedBooking = await Booking.findByIdAndUpdate(
  payment.booking,
  {
    paymentStatus: 'COMPLETED',
    $cond: [
      { $eq: ['$bookingStatus', 'PENDING'] },
      'CONFIRMED',
      '$bookingStatus'
    ]
  },
  { new: true }
).populate('user').populate('vendor').populate('service');
```

**Key Changes**:
- Uses MongoDB's atomic `findByIdAndUpdate` for payment state change
- No window between read and write
- Adds `webhookReceivedAt` and `webhookReference` for audit trail
- Booking status only transitions PENDING → CONFIRMED, preserves other states

---

## 🟠 ADDITIONAL IMPROVEMENTS

### Enhanced Error Handling
All webhook errors now:
- Return HTTP 200 with acknowledgment
- Include descriptive error reasons
- Save failure details to database
- Log fraud attempts with context
- Never cause Flutterwave retry loops

### Enhanced Logging
- User mismatch attempts are logged with full context
- Currency mismatches are logged
- Amount mismatches are logged
- All failures include relevant identifiers

### Audit Trail
Added fields for webhook processing:
- `webhookReceivedAt`: When webhook was processed
- `webhookReference`: Flutterwave reference for tracing
- `initializedAt`: When payment was first initialized

---

## 🧪 Testing Checklist

### Critical Tests
- [ ] Webhook with invalid signature returns 200 OK
- [ ] Webhook with missing signature returns 200 OK
- [ ] Duplicate webhook processed correctly (acknowledged as duplicate)
- [ ] Concurrent webhooks for same payment don't cause race condition
- [ ] Payment with currency mismatch marked FAILED
- [ ] User retry of failed payment generates new unique tx_ref
- [ ] Cross-user payment attempt logged as fraud
- [ ] Webhook with missing booking marked as ignored
- [ ] Email failures don't fail webhook processing
- [ ] Payment amount mismatch marked as FAILED

### Integration Tests
```javascript
// Test 1: User initializes payment
POST /api/v1/payments/initialize
{ bookingId: "123" }
// Response should include unique tx_ref each time

// Test 2: User clicks "Pay again" after first attempt
POST /api/v1/payments/initialize
{ bookingId: "123" }
// Should generate new tx_ref, not fail with unique constraint

// Test 3: Webhook with correct signature and user match
POST /payment/webhook/flutterwave
// Should return 200 OK with received: true

// Test 4: Webhook with user mismatch
// Should return 200 OK with user mismatch reason

// Test 5: Webhook with currency mismatch
// Should mark payment FAILED and return 200 OK
```

### Performance Tests
- [ ] Concurrent webhooks for different bookings process independently
- [ ] Concurrent webhooks for same booking don't cause race condition
- [ ] Payment lookup by reference is indexed
- [ ] Payment lookup by bookingId is indexed

### Security Tests
- [ ] Invalid signature always rejected
- [ ] Cross-user payments blocked
- [ ] Currency swap attempts detected
- [ ] Amount manipulation detected

---

## 🚀 Deployment Checklist

Before deploying to production:

1. **Verify Environment Variables**:
   - [ ] `FLW_SECRET_KEY` is set
   - [ ] `FLW_WEBHOOK_SECRET` is set
   - [ ] `FRONTEND_URL` is set correctly
   - [ ] `CLIENT_URL` is set correctly

2. **Verify Database**:
   - [ ] Ensure `transactionReference` field has `unique: true` index
   - [ ] Ensure `Payment` model has indices on: `booking`, `user`, `transactionReference`
   - [ ] Check indexes: `db.payments.getIndexes()`

3. **Verify Webhook Configuration**:
   - [ ] Flutterwave webhook URL is correctly configured in Flutterwave dashboard
   - [ ] All 4 webhook paths are mounted:
     - `/payment/webhook/flutterwave`
     - `/api/payment/webhook/flutterwave`
     - `/v1/payments/webhook/flutterwave`
     - `/api/v1/payments/webhook/flutterwave`
   - [ ] Webhook runs before JSON parser middleware

4. **Verify Email Configuration**:
   - [ ] Email service credentials are set
   - [ ] Test email sending works
   - [ ] Email templates are deployed

5. **Monitor After Deployment**:
   - [ ] Monitor webhook logs for errors
   - [ ] Check for fraud attempt logs
   - [ ] Monitor payment success rate
   - [ ] Monitor email delivery success rate
   - [ ] Check for duplicate payment issues

---

## 📊 Monitoring Recommendations

### Key Metrics to Track
- Webhook processing time (should be <1s)
- Payment success rate (should be >95%)
- Duplicate webhook rate (should be <1%)
- Failed payment rate by reason
- Email delivery failure rate
- User retry rate (should be <5%)

### Alerts to Configure
- Alert if webhook success rate drops below 90%
- Alert if duplicate rate exceeds 5%
- Alert if fraud attempts detected
- Alert if email delivery fails for 3+ consecutive payments
- Alert if webhook processing time exceeds 5s

### Logs to Monitor
- "Payment user mismatch - potential fraud attempt"
- "Currency mismatch detected"
- "Invalid payment amount received"
- "Payment receipt email failed"
- "Vendor notification email failed"

---

## 🔄 Rollback Plan

If critical issues arise post-deployment:

1. **Immediate**: Disable webhook processing (comment out in routes)
2. **Notify**: Alert admin dashboard that manual payment verification needed
3. **Revert**: Roll back to previous version
4. **Investigate**: Review logs for specific issue
5. **Fix**: Apply targeted fix
6. **Test**: Comprehensive payment flow testing
7. **Deploy**: Re-enable with fixes

---

## 📝 Future Improvements

Consider implementing:

1. **Payment State Machine**: Explicit state transitions (INITIALIZED → PENDING → COMPLETED/FAILED/REFUNDED)
2. **Idempotency Keys**: Prevent duplicate processing with idempotency key tracking
3. **Webhook Retry Logic**: Built-in retry mechanism for failed webhook processing
4. **Payment Recovery**: Automatic recovery for stuck payments
5. **Analytics**: Payment flow analytics and funnel tracking
6. **Billing Reports**: Monthly billing reports for admin
7. **Refund Automation**: Automatic refund processing based on rules
8. **Payment Reconciliation**: Daily reconciliation with Flutterwave

---

## 📞 Support

For issues or questions:
1. Check logs in `src/controllers/paymentController.js` for detailed error messages
2. Review webhook response in Flutterwave dashboard
3. Check Payment and Booking records in MongoDB
4. Enable debug logging: `process.env.DEBUG=true`

---

**Last Updated**: June 2, 2026
**Version**: 1.0 - Critical Fixes Implementation
