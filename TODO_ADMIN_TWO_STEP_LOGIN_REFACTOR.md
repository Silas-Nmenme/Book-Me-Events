# TODO: Admin Two-Step Login (Backend + Frontend) Refactor

- [x] Update `src/models/User.js` to include:
  - [x] `tempToken`, `tempTokenExpiry`
  - [x] `totpSecret`, `isTotpEnabled`
- [x] Create `src/controllers/adminAuthController.js` from scratch:
  - [x] `adminLogin` (Step 1)
  - [x] `verifyAdminTotp` (Step 2)
- [x] Create `src/routes/adminAuthRoutes.js` from scratch:
  - [x] `POST /login` -> adminLogin
  - [x] `POST /verify-totp` -> verifyAdminTotp
- [x] Update `app.js` route registration:
  - [x] mount `/api/v1/auth/admin` to `adminAuthRoutes`
- [x] Enforce guard in shared auth login (`src/controllers/authController.js`) so admins must use admin flow
- [x] Rewrite `Frontend/pages/auth-login.html` to perform Step 1 POST `/api/v1/auth/admin/login`
  - [x] save `adminToken` -> `sessionStorage.adminTempToken`
  - [x] redirect to `/pages/auth-verify-admin-otp.html`
- [x] Rewrite `Frontend/pages/auth-verify-admin-otp.html` to perform Step 2 POST `/api/v1/auth/admin/verify-totp`
  - [x] send only `{ tempToken, totp }`
  - [x] clear `sessionStorage`
  - [x] store full JWT (`localStorage.adminToken`) and redirect to `/admin/dashboard`


- [ ] Final cleanup:
  - [ ] remove old sessionStorage keys `bme_admin_2fa_*` from admin OTP page
  - [ ] ensure admin role casing matches DB values

