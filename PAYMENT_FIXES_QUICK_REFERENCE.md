# Payment Flow Fixes - Quick Reference

## 4 Critical Issues Fixed ✅

### 1️⃣ Webhook Error Responses → 200 OK
**File**: `src/controllers/paymentController.js` (lines 575-760)
**Problem**: 404/400/500 responses triggered Flutterwave retries → duplicate payments
**Solution**: All webhook errors return 200 with `{received: true}` to acknowledge receipt

### 2️⃣ Unique Transaction References
**File**: `src/controllers/paymentController.js` (lines 420-448)
**Problem**: Reused tx_ref on retry attempts → duplicate key error
**Solution**: Generate unique tx_ref each attempt, update existing PENDING payment

### 3️⃣ Booking Ownership Validation
**File**: `src/controllers/paymentController.js` (line 655-666)
**Problem**: No user verification → cross-user fraud possible
**Solution**: Verify `payment.user === data.meta.userId` in webhook

### 4️⃣ Currency Validation
**File**: `src/controllers/paymentController.js` (line 690-704)
**Problem**: No currency mismatch detection → currency swap attacks
**Solution**: Compare Flutterwave currency with expected, mark FAILED if mismatch

---

## Code Changes Summary

### Main Changes in paymentController.js

#### Section 1: Payment Initialization (lines 420-448)
```javascript
// BEFORE: Reused same tx_ref if payment exists
const tx_ref = payment?.transactionReference || `BOOK_${booking._id}_${Date.now()}`;

// AFTER: Always unique tx_ref
const tx_ref = `BOOK_${booking._id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
if (payment) {
  payment = await Payment.findByIdAndUpdate(payment._id, { transactionReference: tx_ref });
}
```

#### Section 2: Webhook Error Responses (multiple locations)
```javascript
// BEFORE: Various error status codes
return res.status(404).json({ message: '...' });

// AFTER: Always 200 OK
return res.status(200).json({ received: true, error: '...' });
```

#### Section 3: User Verification (line 655-666)
```javascript
// NEW: Verify booking ownership
if (payment.user.toString() !== (data?.meta?.userId || '')) {
  console.error('Payment user mismatch - potential fraud attempt');
  return res.status(200).json({ received: true, ignored: true, reason: 'User mismatch' });
}
```

#### Section 4: Currency Validation (line 690-704)
```javascript
// NEW: Validate currency matches
const flutterwaveCurrency = (data?.currency || 'NGN').toUpperCase();
const expectedCurrency = (payment.currency || booking.amountCurrency || 'NGN').toUpperCase();
if (flutterwaveCurrency !== expectedCurrency) {
  payment.paymentStatus = 'FAILED';
  await payment.save();
  return res.status(200).json({ received: true, error: 'Currency mismatch', status: 'FAILED' });
}
```

#### Section 5: Atomic Updates (line 720-745)
```javascript
// BEFORE: Sequential updates vulnerable to race conditions
payment.paymentStatus = 'COMPLETED';
await payment.save();

// AFTER: Atomic updates
const updatedPayment = await Payment.findByIdAndUpdate(
  payment._id,
  { paymentStatus: 'COMPLETED', ... },
  { new: true }
);
```

---

## Testing Instructions

### Quick Test - Webhook Response Codes
```bash
# Should return 200 OK, not 404
curl -X POST http://localhost:5000/api/payment/webhook/flutterwave \
  -H "verif-hash: invalid" \
  -H "Content-Type: application/json" \
  -d '{"event":"charge.completed","data":{"tx_ref":"invalid"}}'
```

### Quick Test - Payment Retry
```javascript
// In browser console, try initializing payment twice
const booking1 = await initializeFlutterwavePayment(bookingId);
console.log('First tx_ref:', booking1.tx_ref);

const booking2 = await initializeFlutterwavePayment(bookingId);
console.log('Second tx_ref:', booking2.tx_ref);

// Should see different tx_ref values - no unique constraint error
```

### Quick Test - User Verification
```bash
# Check logs - should see user mismatch if webhook has wrong userId
# Log message: "Payment user mismatch - potential fraud attempt"
```

---

## Deployment Steps

1. **Update Code** ✅ (Already done)
   - paymentController.js updated with all fixes

2. **Test Locally** ⏳ (Next step)
   ```bash
   npm test
   # Run manual payment flow tests
   ```

3. **Deploy to Production** ⏳ (After testing)
   ```bash
   git add src/controllers/paymentController.js
   git commit -m "fix: critical payment flow security and reliability issues"
   git push origin main
   ```

4. **Verify in Production** ⏳ (After deployment)
   - [ ] Webhook logs show 200 OK responses
   - [ ] No duplicate payment errors
   - [ ] Currency mismatches detected and logged
   - [ ] User fraud attempts detected and logged

---

## Before & After Comparison

| Issue | Before | After |
|-------|--------|-------|
| Webhook 404 error | Triggers Flutterwave retry → duplicates | Returns 200 OK → no retry |
| Retry payment | Fails with unique constraint error | Works with new unique tx_ref |
| Cross-user fraud | Possible - no verification | Blocked - user verified |
| Currency swap | No detection | Detected and failed |
| Concurrent webhooks | Race condition possible | Atomic updates prevent it |

---

## Files Modified

- ✅ `src/controllers/paymentController.js` - All 4 critical fixes + improvements
- ✅ `PAYMENT_FLOW_FIXES.md` - Comprehensive documentation

## Files Created

- ✅ `PAYMENT_FLOW_FIXES.md` - Complete fix guide
- ✅ `PAYMENT_FIXES_QUICK_REFERENCE.md` - This file

---

**Status**: Ready for testing and deployment
**Last Updated**: June 2, 2026
