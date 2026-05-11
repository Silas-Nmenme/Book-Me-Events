# TODO - Email verification

- [ ] Implement JWT-signed email verification link for USER/ADMIN (no DB storage)
- [ ] Update `POST /api/v1/auth/verify-email` to accept token from query/body and verify signature + expiry
- [ ] Keep existing protect-based behavior as fallback (if token missing, only allow verified user update)
- [ ] Add `POST /api/v1/auth/send-verification-email` endpoint (best-effort) to email verification link
- [ ] Add frontend dashboard banner for any logged-in user with `isVerified=false`
- [ ] Banner CTA calls `POST /api/v1/auth/verify-email` (with token from banner/link) or triggers resend
- [ ] Update login/register flows to include resend/verify behavior
- [x] Test manually: register -> verify -> fetchMe shows isVerified=true (backend verify-token path)
- [ ] Send verification email endpoint + link wiring
- [ ] Frontend dashboard banner + CTA calling verify-email


