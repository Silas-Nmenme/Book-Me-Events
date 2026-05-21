- [x] Locate where malformed request id `${encodeURIComponent(id)}` is being sent to backend.
- [x] Add defensive validation for request ids in Frontend/js/pages/user-request.js (and any other page that calls /api/v1/requests/:id).
- [x] If validation fails, prevent API call and show toast with helpful error.
- [ ] Re-test chat/load flows that fetch request details.


