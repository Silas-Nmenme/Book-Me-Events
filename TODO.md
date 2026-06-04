# TODO — Book Me Events UI/UX audit & redesign

## Phase 1 — Visual system foundation (CSS)
- [ ] Update `Frontend/css/styles.css` with a polished font pairing + `font-family` variables.
- [ ] Add required CSS token variables:
  - `--color-primary, --color-accent, --color-surface, --color-text-primary, --color-text-muted, --color-border,
    --color-success, --color-warning, --color-danger`.
- [ ] Introduce/upgrade elevated card base styles:
  - radius 12–16px
  - layered box-shadow
  - hover: `transform: translateY(-4px)` + shadow depth increase
  - smooth transitions for interactive elements.
- [ ] Add status pill system classes (semantic):
  - e.g. `.bme-pill--pending`, `.bme-pill--confirmed`, `.bme-pill--cancelled`.
- [ ] Add staggered fade-in animation for card grids and ensure reduced-motion support.

## Phase 2 — Status pills + card hierarchy integration (JS/HTML)
- [ ] Update card builders to use semantic pill classes instead of Bootstrap `text-bg-*`:
  - `Frontend/js/pages/requests.js`
  - `Frontend/js/pages/bookings.js`
  - `Frontend/pages/user-tickets.html` + `Frontend/js/pages/user-tickets.js`
- [ ] Update any existing status badges:
  - `Frontend/pages/vendor-dashboard.html` (`#vendorKycBadge`)

## Phase 3 — Dashboard stat strip cards
- [ ] Add top summary stat strip cards to:
  - `Frontend/pages/user-dashboard.html`
  - `Frontend/pages/vendor-dashboard.html`
  - `Frontend/pages/admin-dashboard.html` (convert existing `#statsGrid` blocks)
- [ ] Update `Frontend/pages/vendor-analytics.html` cards to match the new stat-card style.

## Phase 4 — Interaction polish
- [ ] Add skeleton loading UI toggles for:
  - `#requestList` / `#bookingList` / `#ticketsList` / vendor service list
  - Admin stats shells (`#statsShell`, etc.)
- [ ] Ensure all card CTAs have touch targets >= 44px on mobile (review `.btn-sm` usage inside cards).

## Phase 5 — Mobile responsiveness sweep
- [ ] Verify 375px layout for all pages updated in Phases 2–4.
- [ ] Fix horizontal overflow / cut-off buttons by adjusting spacing & grid breakpoints.

## Phase 6 — Final scan
- [ ] Re-audit for remaining card patterns (tables vs cards) and ensure consistent visuals.
- [ ] Confirm no regressions in JS rendering shells and modals.

