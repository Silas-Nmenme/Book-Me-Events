# TODO

- [x] Rewrite `src/utils/emailClient.js` to prevent failures when SMTP env vars are missing

  - [ ] Validate required SMTP env vars (EMAIL_HOST, EMAIL_PORT, MAIL_USER, EMAIL_PASS) and disable email sending if missing
  - [ ] Keep a best-effort transporter init (no crashes if env missing)
  - [ ] Provide `sendEmail({to, subject, text, html})` compatibility wrapper used by controllers
  - [ ] Fix helper functions to use the actual exports in `src/utils/emailTemplates.js`
  - [x] Ensure OTP/welcome/login/reset helpers behave safely even if templates don’t exist

- [x] Smoke test by running `npm run dev` and triggering auth flows to verify emails are attempted/sent



