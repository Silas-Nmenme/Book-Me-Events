# TODO - Rewrite Requests Flow (User/Vendor)

## Step 1: Backend changes
- [ ] Update `src/controllers/requestController.js#createRequest` to support manual requests without requiring a `service` id upfront.
  - [ ] UI will provide dropdown selection of `Service you sorted after`.
  - [ ] Backend will accept `serviceId` and/or a `serviceName` + `serviceCategory` payload and resolve the Service + vendor.
- [ ] Add request delete endpoint for users: `DELETE /api/v1/requests/:id`.
- [ ] Ensure vendor can list incoming requests via existing `GET /api/v1/requests` with vendor filtering.

## Step 2: Frontend new pages
- [ ] Create `Frontend/pages/user-service.html` (service browsing + request button that forwards to request creation).
- [ ] Create `Frontend/pages/user-request.html` (manual create + Your requests list with edit/delete).
  - [ ] Manual form uses “Service you sort after” dropdown (no service id field exposed).
- [ ] Create `Frontend/pages/vendor-service.html` (incoming requests with accept/decline buttons).

## Step 3: Frontend JS modules
- [ ] Create `Frontend/js/pages/user-service.js`
- [ ] Create `Frontend/js/pages/user-request.js`
- [ ] Create `Frontend/js/pages/vendor-service.js`

## Step 4: Wire navigation / reconfigure existing pages
- [ ] Update `Frontend/pages/services.html` to direct user “Create request” / service card actions into `user-service.html`.
- [ ] Update `Frontend/pages/vendor-dashboard.html` to direct incoming requests into `vendor-service.html`.

## Step 5: Validate end-to-end
- [ ] Vendor creates services -> user browses -> user creates request -> vendor sees incoming -> accept/decline works.
- [ ] User can create manual request -> list/edit/delete works.

