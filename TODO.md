# TODO

## Service creation image upload + vendor authorization

- [ ] Update `src/controllers/serviceController.js`:
  - Ensure vendor creation authorization uses vendor profile existence (not `req.user.role`), and return clear 403 error when Vendor document missing.
  - Fix role mismatch confusion.
- [ ] Ensure frontend vendor dashboard creates services using multipart upload (`images` field) when files are selected, instead of uploading separately then sending JSON.
- [ ] Add a quick debug endpoint or console logging (optional) to confirm `req.user.role` and `Vendor.user` mapping when failing.


