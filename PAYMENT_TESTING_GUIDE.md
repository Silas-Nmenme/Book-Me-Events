# Payment Flow Testing Guide

## Quick Test Commands

### Test 1: Webhook Returns 200 OK for Errors
```bash
# Test invalid signature
curl -X POST http://localhost:5000/api/payment/webhook/flutterwave \
  -H "verif-hash: invalid-signature" \
  -H "Content-Type: application/json" \
  -d '{"event":"charge.completed","data":{"tx_ref":"test123","status":"successful"}}'

# Expected response: 200 OK with {"received": true, "error": "..."}
```

### Test 2: Unique Transaction References
```bash
# In browser console, run:
async function testPaymentRetry() {
  const bookingId = "YOUR_BOOKING_ID";
  
  // First initialization
  const response1 = await fetch('/api/v1/payments/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId })
  });
  const data1 = await response1.json();
  console.log('First tx_ref:', data1.tx_ref);
  
  // Second initialization (retry)
  const response2 = await fetch('/api/v1/payments/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId })
  });
  const data2 = await response2.json();
  console.log('Second tx_ref:', data2.tx_ref);
  
  // Verify different
  console.assert(data1.tx_ref !== data2.tx_ref, 'tx_ref should be different!');
  console.log('✅ Test passed: Different tx_ref for retry');
}

testPaymentRetry();
```

### Test 3: User Ownership Validation
```bash
# Check logs for fraud detection
# After sending webhook with mismatched userId:
tail -f your-app.log | grep "Payment user mismatch"

# You should see: "Payment user mismatch - potential fraud attempt"
```

### Test 4: Currency Validation
```bash
# Simulate webhook with wrong currency
curl -X POST http://localhost:5000/api/payment/webhook/flutterwave \
  -H "verif-hash: VALID_HASH_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "event":"charge.completed",
    "data":{
      "tx_ref":"BOOK_123_456_abc",
      "status":"successful",
      "amount":5000,
      "currency":"USD",
      "amount_settled":5000
    }
  }'

# Check logs: "Currency mismatch detected"
```

---

## Full Testing Workflow

### Prerequisites
- Node.js/Express server running
- MongoDB connected
- Flutterwave test credentials configured
- `.env` file with FLW_SECRET_KEY and FLW_WEBHOOK_SECRET

### Setup
```bash
# Install dependencies (if not already done)
npm install

# Start server
npm start
# Server should start on http://localhost:5000
```

---

## Test Scenarios

### Scenario 1: Successful Payment Flow
```javascript
// Step 1: User creates booking
const booking = await POST('/api/v1/bookings', {
  request: 'REQUEST_ID',
  service: 'SERVICE_ID',
  eventDate: '2024-12-25',
  eventLocation: 'Lagos',
  totalAmount: 50000
});
const bookingId = booking._id;

// Step 2: User initializes payment
const paymentInit = await POST('/api/v1/payments/initialize', {
  bookingId
});
console.log('Payment link:', paymentInit.link);
console.log('tx_ref:', paymentInit.tx_ref);

// Step 3: User completes payment on Flutterwave (simulated)
// Flutterwave sends webhook with successful payment

// Step 4: Webhook is processed
// Check: Payment marked COMPLETED
// Check: Booking marked COMPLETED
// Check: User receives receipt email
// Check: Vendor receives notification email

// Verification
const payment = await GET(`/api/v1/payments/${paymentInit.paymentId}`);
assert(payment.paymentStatus === 'COMPLETED');

const updatedBooking = await GET(`/api/v1/bookings/${bookingId}`);
assert(updatedBooking.paymentStatus === 'COMPLETED');
assert(updatedBooking.bookingStatus === 'CONFIRMED');
```

### Scenario 2: Payment Retry
```javascript
// Step 1: User initializes payment first time
const init1 = await POST('/api/v1/payments/initialize', { bookingId });
const tx_ref_1 = init1.tx_ref;

// Step 2: Payment fails (Flutterwave webhook with error)
// Payment stays PENDING

// Step 3: User clicks "Pay again"
const init2 = await POST('/api/v1/payments/initialize', { bookingId });
const tx_ref_2 = init2.tx_ref;

// Verification
assert(tx_ref_1 !== tx_ref_2, 'Transaction references must be different');
assert(init2.success === true, 'Retry should succeed');

// Should see only 1 Payment record with latest tx_ref
const payments = await GET('/api/v1/payments?booking=' + bookingId);
const pendingPayments = payments.filter(p => p.paymentStatus === 'PENDING');
assert(pendingPayments.length === 1, 'Only 1 pending payment record');
assert(pendingPayments[0].transactionReference === tx_ref_2);
```

### Scenario 3: Webhook Error Handling
```javascript
// Test Case: Invalid signature should return 200
const response = await fetch('/api/payment/webhook/flutterwave', {
  method: 'POST',
  headers: {
    'verif-hash': 'INVALID_SIGNATURE',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    event: 'charge.completed',
    data: { tx_ref: 'test' }
  })
});

assert(response.status === 200, 'Should return 200 even with invalid signature');
const data = await response.json();
assert(data.received === true, 'Should indicate received');

// Check logs: "Invalid Flutterwave webhook signature" should be present
```

### Scenario 4: Concurrent Webhooks
```javascript
// Test: Send two webhook requests simultaneously for same payment
const webhook1 = fetch('/api/payment/webhook/flutterwave', {
  method: 'POST',
  headers: { 'verif-hash': 'VALID_HASH', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'charge.completed',
    data: { tx_ref: 'BOOK_123_456', status: 'successful', amount: 50000 }
  })
});

const webhook2 = fetch('/api/payment/webhook/flutterwave', {
  method: 'POST',
  headers: { 'verif-hash': 'VALID_HASH', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'charge.completed',
    data: { tx_ref: 'BOOK_123_456', status: 'successful', amount: 50000 }
  })
});

const [res1, res2] = await Promise.all([webhook1, webhook2]);

assert(res1.status === 200);
assert(res2.status === 200);

// Verify payment is only marked COMPLETED once
const payment = await GET('/api/v1/payments/ref/BOOK_123_456');
assert(payment.paymentStatus === 'COMPLETED');
assert(payment.webhookReceivedAt !== null, 'Should have webhook timestamp');

// Check logs: One "received: true" and one "duplicated: true"
```

### Scenario 5: Currency Mismatch
```javascript
// Setup: Create booking with NGN currency
const booking = await POST('/api/v1/bookings', {
  eventDate: '2024-12-25',
  totalAmount: 50000,
  // amountCurrency defaults to NGN
});

// Initialize payment (expects NGN)
const init = await POST('/api/v1/payments/initialize', { 
  bookingId: booking._id 
});

// Simulate webhook with USD instead of NGN
const response = await fetch('/api/payment/webhook/flutterwave', {
  method: 'POST',
  headers: { 'verif-hash': 'VALID_HASH', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'charge.completed',
    data: {
      tx_ref: init.tx_ref,
      status: 'successful',
      currency: 'USD',  // WRONG currency
      amount: 50000,
      amount_settled: 50000
    }
  })
});

// Verification
assert(response.status === 200);
const data = await response.json();
assert(data.error === 'Currency mismatch');

// Payment should be marked FAILED
const payment = await GET(`/api/v1/payments/${init.paymentId}`);
assert(payment.paymentStatus === 'FAILED');

// Check logs: "Currency mismatch detected"
```

### Scenario 6: User Mismatch (Fraud Attempt)
```javascript
// Setup: User A creates booking
const bookingByUserA = await POST('/api/v1/bookings', { 
  // Logged in as User A
});

// Initialize payment (creates payment record with userId = User A)
const init = await POST('/api/v1/payments/initialize', { 
  bookingId: bookingByUserA._id 
});

// Simulate webhook with User B's ID (fraud attempt)
const response = await fetch('/api/payment/webhook/flutterwave', {
  method: 'POST',
  headers: { 'verif-hash': 'VALID_HASH', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'charge.completed',
    data: {
      tx_ref: init.tx_ref,
      meta: {
        userId: 'DIFFERENT_USER_ID',  // User B trying to claim payment
        bookingId: bookingByUserA._id
      },
      status: 'successful',
      amount: 50000
    }
  })
});

// Verification
assert(response.status === 200);
const data = await response.json();
assert(data.reason === 'User mismatch');

// Payment should still be PENDING
const payment = await GET(`/api/v1/payments/${init.paymentId}`);
assert(payment.paymentStatus === 'PENDING');

// Check logs: "Payment user mismatch - potential fraud attempt"
```

---

## Automated Testing Script

Create `test/payment-flow.test.js`:

```javascript
const request = require('supertest');
const app = require('../app');

describe('Payment Flow - Critical Fixes', () => {
  
  test('Webhook returns 200 for invalid signature', async () => {
    const response = await request(app)
      .post('/api/payment/webhook/flutterwave')
      .set('verif-hash', 'invalid')
      .send({ event: 'charge.completed', data: { tx_ref: 'test' } });
    
    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });
  
  test('Unique tx_ref for payment retry', async () => {
    const booking = await createTestBooking();
    
    const init1 = await initializePayment(booking._id);
    const init2 = await initializePayment(booking._id);
    
    expect(init1.tx_ref).not.toBe(init2.tx_ref);
  });
  
  test('Currency mismatch detected', async () => {
    const payment = await createTestPayment({ currency: 'NGN' });
    
    const response = await request(app)
      .post('/api/payment/webhook/flutterwave')
      .set('verif-hash', generateValidHash(...))
      .send({
        event: 'charge.completed',
        data: {
          tx_ref: payment.transactionReference,
          currency: 'USD',  // Mismatch
          status: 'successful'
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.error).toBe('Currency mismatch');
    
    const updatedPayment = await getPayment(payment._id);
    expect(updatedPayment.paymentStatus).toBe('FAILED');
  });
  
  test('User mismatch prevents fraud', async () => {
    const payment = await createTestPayment({ userId: 'user123' });
    
    const response = await request(app)
      .post('/api/payment/webhook/flutterwave')
      .set('verif-hash', generateValidHash(...))
      .send({
        event: 'charge.completed',
        data: {
          tx_ref: payment.transactionReference,
          meta: { userId: 'attacker456' },  // Different user
          status: 'successful'
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.reason).toBe('User mismatch');
  });
  
});
```

Run with: `npm test test/payment-flow.test.js`

---

## Logging Verification

### Check for Expected Log Messages

```bash
# After webhook processing:
grep "Flutterwave webhook received" app.log
grep "Payment not found" app.log
grep "Invalid webhook signature" app.log
grep "Currency mismatch detected" app.log
grep "Payment user mismatch - potential fraud attempt" app.log
grep "Payment receipt email" app.log
grep "Vendor notification email" app.log

# After payment initialization:
grep "Flutterwave payment error" app.log
grep "Payment created successfully" app.log

# Success logs:
grep "received: true" app.log
grep "status: COMPLETED" app.log
```

---

## Checklist

- [ ] Test 1: Webhook returns 200 for errors
- [ ] Test 2: Unique tx_ref for retries
- [ ] Test 3: User fraud attempts logged
- [ ] Test 4: Currency mismatch detected
- [ ] Test 5: Concurrent webhooks handled
- [ ] Test 6: Payment marked COMPLETED
- [ ] Test 7: Booking marked CONFIRMED
- [ ] Test 8: Email sent to user and vendor
- [ ] Test 9: Audit trail logged (webhookReceivedAt, webhookReference)
- [ ] Test 10: All error responses return 200 OK

---

## Expected Success Indicators

✅ All webhook error responses return HTTP 200  
✅ Payment retry generates unique tx_ref  
✅ User ownership is verified  
✅ Currency mismatches are detected  
✅ Fraud attempts are logged  
✅ Atomic updates prevent race conditions  
✅ Emails are sent successfully  
✅ Payment records have audit trail  

---

**Last Updated**: June 2, 2026
