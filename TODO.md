# BOOK ME EVENTS — MVP Implementation TODO

## Stage 0 — Security correctness (prerequisites)
- [ ] Lock down `POST /api/v1/uploads/generic` by adding `protect` + role-safe checks in `src/routes/uploadRoutes.js`.
- [ ] Fix vendor-response authorization bug in `src/controllers/reviewController.js#addVendorResponse` (compare Vendor IDs correctly).
- [ ] Harden `GET /api/v1/payments/:id` and other payment reads in `src/controllers/paymentController.js#getPayment` (enforce ownership or ADMIN role).

## Stage 1 — USER MVP
- [ ] Add `ActivityLog` model + write events from key controllers (requests/bookings/payments/reviews/messages).
- [ ] Add `GET /api/v1/users/me/activity`.
- [ ] Add booking tracking timeline endpoint (derive from `Booking.bookingStatus` + `Payment.paymentStatus`).
- [ ] Add announcements read/unread MVP (models + endpoints).
- [ ] Add USER frontend pages: booking tracking, notifications, activity.
- [ ] Add minimal support tickets foundation (create + list).

## Stage 2 — VENDOR MVP
- [ ] Add vendor analytics endpoint(s).
- [ ] Add vendor SLA metrics (derived or stored) + enforcement/UX.
- [ ] Add vendor ticket triage endpoints.
- [ ] Add promotions model + CRUD endpoints (MVP).
- [ ] Add vendor frontend pages/widgets for analytics + tickets + promotions.

## Stage 3 — ADMIN MVP
- [ ] Add immutable audit log + admin governance endpoints.
- [ ] Replace “vendor reject = delete” with KY C review workflow (status + reason).
- [ ] Add fraud/anomaly signals endpoint(s) for admin.
- [ ] Add admin frontend widgets/pages: audit, fraud signals, KYC status/reviews.

## After all stages
- [ ] Smoke-test: auth, request->accept->booking->payment->webhook->completion.
- [ ] Verify access control: USER cannot read others’ payments/messages; VENDOR cannot read others’ data.

