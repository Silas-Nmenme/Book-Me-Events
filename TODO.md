# TODO

## Completed / Current
- [ ] Align vendor-dashboard.html with service controller + routes by adding vendor service CRUD UI.

## Next steps to implement
1. Add vendor service management section to `Frontend/pages/vendor-dashboard.html` (list + create + edit + delete).
2. Add JS module `Frontend/js/pages/vendor-dashboard.js` to wire UI to backend endpoints:
   - POST `/api/v1/services`
   - PUT `/api/v1/services/:id`
   - DELETE `/api/v1/services/:id`
3. Update `Frontend/pages/vendor-dashboard.html` to import and initialize `initVendorDashboard`.
4. Ensure only `VENDOR` can see CRUD controls; show error if not authorized.
5. Smoke test: verify CRUD calls work against `src/controllers/serviceController.js` and `src/routes/serviceRoutes.js`.

