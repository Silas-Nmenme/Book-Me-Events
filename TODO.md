# TODO - Transactional Email Audit & Refactor

## Step 1 — Enumerate email trigger points
- [x] Read controllers likely to call `sendEmail` (authController, bookingController, vendorController, verifyEmailController, requestController, paymentController)
- [ ] Record template name + dynamic fields passed
- [ ] Record Mongoose populate requirements and potential missing populates

## Step 2 — PASS 1 (Data Integrity)
- [ ] For each template: list dynamic fields it expects
- [ ] Add shared `formatCurrency` helper and replace ad-hoc formatting
- [ ] Add shared `formatDate` helper and replace raw date output
- [ ] Add fallback defaults so templates never render undefined
- [ ] Update controllers to add missing `.populate()` where required

## Step 3 — PASS 2 (Design refactor)
- [ ] Rebuild `src/utils/emailTemplates.js` using:
  - [ ] TABLE-based layout (outer wrapper)
  - [ ] Inline-only CSS (no `<style>` blocks)
  - [ ] Key details as key-value HTML table
  - [ ] Premium deep forest green palette
  - [ ] CTA button styled as a real button
  - [ ] Proper plain-text fallbacks matching HTML

## Step 4 — PASS 3 (Motion-safe only)
- [ ] Remove animations / keyframes
- [ ] Optionally add Cloudinary GIFs only if requested
  - [ ] Payment receipt GIF
  - [ ] Booking confirmation GIF

## Step 5 — Verify
- [ ] Ensure Node can load updated module without syntax errors
- [ ] Run smoke checks for payment receipt + vendor notification paths
- [ ] Run lint/test if available

