# TODO - Book Me Events UI/UX Redesign + New Widgets

## Step 1 — Global theme + animations
- [x] Updated `Frontend/css/styles.css` with required `:root` palette + dark mode via `html[data-theme="dark"]`.
- [x] Added required animations/utilities (fadeUp, skeleton, widget hover, dashboard-card stagger, btn ripple).
- [x] Added landing JS `Frontend/js/landing-redesign.js` (confetti, typewriter, platform stats, public activity toasts, search redirect).

## Step 2 — Landing page rewrite (HTML + wiring)
- [ ] Rewrite `Frontend/pages/index.html` to match the redesigned navbar/hero/counters/confetti canvas/typewriter DOM/marquee/category grid/testimonials/footer.
- [ ] Wire `Frontend/js/landing-redesign.js` and add necessary CSS hooks/classes.

## Step 3 — Dashboard rewrite (HTML layout + widgets mounting)
- [ ] Rewrite `Frontend/pages/user-dashboard.html` to the new sidebar + topbar + scrollable main.
- [ ] Insert widget containers (6 widgets) and dashboard stat cards w/ required markup for count-up + trend.
- [ ] Add widget bootstrapping JS in `Frontend/js/pages/user-dashboard.js` or new entry file.

## Step 4 — Widget implementations (JS)
- [ ] Create `Frontend/js/widgets/upcoming-events.js`
- [ ] Create `Frontend/js/widgets/chat-preview.js`
- [ ] Create `Frontend/js/widgets/spend-chart.js`
- [ ] Create `Frontend/js/widgets/activity-feed.js`
- [ ] Create `Frontend/js/widgets/review-nudge.js`
- [ ] Create `Frontend/js/widgets/vendor-map.js`

## Step 5 — Dashboard stats count-up + toast helpers
- [ ] Ensure dashboard stat cards count-up animation works with `[data-count]` OR current markup.
- [ ] Ensure toast host + `showToast()` exists and is compatible with existing `Frontend/js/ui.js`.

## Step 6 — Backend endpoints
- [ ] Add `GET /api/v1/stats/platform`
- [ ] Add `GET /api/v1/bookings/upcoming`
- [ ] Add `GET /api/v1/payments/summary`
- [ ] Add `GET /api/v1/activity-feed` (+ `public=true` variant)
- [ ] Add `GET /api/v1/messages/preview`
- [ ] Add `POST /api/v1/reviews` create route if needed (review model already exists)
- [ ] Add `GET /api/v1/vendors?city=&category=&limit=` with lat/lng for map

## Step 7 — Mobile responsiveness
- [ ] Sidebar collapses to hamburger on <768px.

## Step 8 — Verify build/runtime
- [ ] Frontend: run lint/build (if available) / open locally and check critical flows.
- [ ] Backend: ensure all new endpoints return `{ success, data, message }` and handle errors.
- [ ] Test widget fetches show skeleton first and render on success.

