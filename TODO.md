# TODO

- [ ] Plan: Make profile/admin/vendor uploads require authentication and persist Cloudinary URL to DB
- [ ] Implement: Add `protect` to `/api/v1/uploads/profile-picture`
- [ ] Implement: Update `/api/v1/uploads/profile-picture` to save uploaded image to `User.profilePicture` (for admin/user)
- [ ] Implement: Add vendor profile picture support (likely also `User.profilePicture`, since Vendor model has no image field)
- [ ] Implement: Add vendor showcase uploads (video/image) - determine where to store (currently only Service.images exists)
- [ ] Implement: Ensure correct request field names and route URL expectations
- [ ] Test: Use sample curl/postman with Authorization header + multipart/form-data
- [ ] Test: Verify DB update + Cloudinary upload

