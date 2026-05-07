# TODO

- [ ] Replicate Belleful-like email flow to avoid crash when SMTP credentials are missing.
- [ ] Implement CDN-ready HTML templates per email function (OTP/welcome/login success/password reset/contact/order/order status).
- [ ] Update `src/utils/emailClient.js` to use the templates and to fail gracefully (no-op) when env vars are missing.
- [ ] Ensure `src/controllers/authController.js` continues to work with the updated email client.
- [ ] Run `npm run dev` and hit registration/forgot-password to confirm the original error is gone.

