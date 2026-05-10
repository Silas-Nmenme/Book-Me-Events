# TODO - Book Me Events (rewrite plan)

## Phase 1: Deployment compatibility (Netlify frontend + Vercel backend)
- [x] Initial repo inspection and route contract confirmation.
- [ ] Ensure frontend always calls the correct backend base URL (Vercel URL) even in production.
- [ ] Add better API error logging toast for failed fetches.

## Phase 2: Frontend rewrite (landing + auth)
- [ ] Create/upgrade Landing page header with prominent Login/Register buttons.
- [ ] Implement landing CTA behavior.
- [ ] Make auth pages use consistent token storage + redirect.

## Phase 3: Smoke tests
- [ ] Verify backend endpoints work: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`.
- [ ] Verify deployed flow: Landing -> Register -> Login -> Profile.


