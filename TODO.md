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


# TODO - Route parity (backend @routes vs frontend)

- [x] Add missing frontend API functions for backend user endpoints in `Frontend/js/api.js`:
  - [x] getUser(id) -> GET `/api/v1/users/:id`
  - [x] updateUser(id, payload) -> PUT `/api/v1/users/:id`
  - [x] deleteUser(id) -> DELETE `/api/v1/users/:id`
  - [x] getUserBookings(id) -> GET `/api/v1/users/:id/bookings`
  - [x] getUserRequests(id) -> GET `/api/v1/users/:id/requests`
- [x] Search frontend for any usage of `/api/v1/users` to confirm nothing else is needed.
- [ ] (Optional) Run `npm test` / `npm run lint` if available.




