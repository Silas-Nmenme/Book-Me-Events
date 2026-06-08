# TODO

## Book Me Events - Admin login 2FA bug

- [x] Identify broken flow: Admin OTP verify page was re-hitting `/api/v1/auth/login` but UI request body could omit/empty `password`.
- [x] Inspect relevant files: `Frontend/pages/auth-login.html`, `Frontend/pages/auth-verify-admin-otp.html`, `Frontend/js/api.js`, `src/controllers/authController.js`, `src/routes/authRoutes.js`, `src/routes/admin2faRoutes.js`, `src/controllers/admin2faController.js`.
- [x] Fix admin OTP verify request payload to explicitly include `password` as a string when calling `/api/v1/auth/login`.
- [ ] Run frontend/backend checks and verify 2FA login succeeds without 500.

