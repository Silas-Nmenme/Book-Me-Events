# 📚 Book Me Events - Project Summary & Quick Start

**Book Me Events** is a comprehensive multi-vendor event services marketplace built for the Nigerian market.

---

## 🎉 Project Overview

**Book Me Events** is a complete platform where:

- **Service Providers** (Vendors) list and manage their event services
- **Event Organizers** (Users) browse, request, and book services
- **Admin** monitors activities and maintains platform health

---

## 📦 Cloudinary Uploads (Profile Pictures)

### Requirements
Create a `.env` file with:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Upload endpoints
Base: `/api/v1/uploads`

**1) Profile picture**
- `POST /profile-picture`
- `multipart/form-data`
- field name: `image`

**2) Vendor KYC**
- `POST /vendor-kyc`
- `multipart/form-data`
- field name: `image`

Each endpoint returns:
- `url` (Cloudinary secure URL)
- `publicId`

You can store `url` into `User.profilePicture`.

---

## 🔌 Storage

- **Storage**: Cloudinary

---

## 🎯 Key Features at a Glance

### For Users (Event Organizers)
✅ Browse services by category/location/price
✅ Request services from vendors
✅ Chat with vendors
✅ Book and pay for services
✅ Rate and review services
✅ Manage multiple events

### For Vendors (Service Providers)
✅ Create business profile with KYC
✅ List multiple services with packages
✅ Accept/decline service requests
✅ Chat with customers
✅ Track earnings and payouts
✅ View performance metrics
✅ Manage availability

### For Admin
✅ Monitor all platform activities
✅ Verify vendors via KYC
✅ View financial reports
✅ Handle disputes
✅ Manage users and vendors
✅ View platform analytics

---

## 🚀 Getting Started

- Set up environment variables (`.env`)
- Start backend
- Use Postman to test upload endpoints with `multipart/form-data`

---

## 🎲 Success Criteria

- Upload endpoints return `secure_url` and `public_id`
- Frontend can store returned `url` into user/vendor profile fields

---

**Version:** 1.0
**Created:** May 6, 2026
**Status:** Ready for Development

