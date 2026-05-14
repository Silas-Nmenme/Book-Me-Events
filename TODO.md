# TODO

## Admin backend audit + UI integration

- [ ] Identify all backend routes/controllers that are specifically admin-authorized (role: ADMIN) or admin-scoped.
- [ ] Map admin responsibilities to UI pages/components.
- [ ] Verify existing frontend admin API functions and check for missing ones.
- [ ] Implement admin dashboard widgets (pending vendors, users management, bookings, payments, stats, announcements) connected to backend routes.
- [ ] Ensure consistent auth/role handling (redirect if not ADMIN).
- [ ] Wire UI actions to backend mutations (verify vendor, reject vendor, toggle user status, send announcement).
- [ ] Add/verify pagination and loading/error states.
- [ ] Run a quick backend smoke test (start server / curl key endpoints if tooling is available).
- [ ] Run frontend smoke test (open admin-dashboard.html, ensure no JS errors).

