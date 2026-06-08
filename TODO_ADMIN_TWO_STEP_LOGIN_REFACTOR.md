# Admin OTP Login Refactor Checklist (Email OTP, NOT TOTP)

## Goal A — Backend email OTP flow
- [ ] Create `src/routes/adminLoginRoutes.js` with:
  - [ ] `POST /api/v1/admin/login/start-otp`
  - [ ] `POST /api/v1/admin/login/verify-otp`
- [ ] Create `src/controllers/adminLoginController.js` implementing:
  - [ ] Validate admin email/password
  - [ ] Generate 6-digit email OTP + expiry
  - [ ] Store OTP on admin record (`otpCode`, `otpExpiresAt`, `otpPurpose` using a dedicated purpose string)
  - [ ] Send OTP via existing email client/templates
  - [ ] Return short `{ success:true, message:'2FA required' }` without accepting/validating TOTP
  - [ ] Verify OTP and issue JWT
- [ ] Update `src/controllers/authController.js`:
  - [ ] Remove admin TOTP verification block from `exports.login`
  - [ ] Remove tolerance that allows missing password when `totpCode` exists
  - [ ] Ensure admin login no longer accepts TOTP codes anywhere

## Goal B — Frontend flow updates
- [ ] Update `Frontend/pages/auth-login.html`:
  - [ ] Remove redirect logic that detects `2fa/totp` errors
  - [ ] For ADMIN users, call `/api/v1/admin/login/start-otp` then redirect to `auth-verify-admin-otp.html`
- [ ] Update `Frontend/pages/auth-verify-admin-otp.html`:
  - [ ] Replace TOTP input label to email OTP
  - [ ] Replace API call to `/api/v1/admin/login/verify-otp` (email+otp)
- [ ] Ensure old TOTP detection/redirect behavior is removed/disabled

## Goal C — Route/controller refactor in app.js
- [ ] Mount new routes in `app.js`:
  - [ ] `safeRoute('/api/v1/admin', require('./src/routes/adminLoginRoutes'))`
- [ ] Ensure no remaining mounted routes implement *login* TOTP verify

## Validation
- [ ] Test: start-otp returns “2FA required” and sends email
- [ ] Test: verify-otp returns JWT
- [ ] Test: `POST /api/v1/auth/login` for admin fails when TOTP is provided (and never validates TOTP)

