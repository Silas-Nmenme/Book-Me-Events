# 🔌 Book Me Events - API Specification

## Base URL
```
Development:  http://localhost:5000/api
Production:   https://api.bookmeevents.com/api
```

## API Versioning
```
Current Version: v1
Header: X-API-Version: v1
```

---

## 📋 Authentication Endpoints

### 1. User Registration
```
POST /v1/auth/register
Content-Type: application/json

REQUEST:
{
  "email": "user@example.com",
  "phone": "+2348012345678",
  "password": "SecurePass123",
  "first_name": "John",
  "last_name": "Doe",
  "account_type": "USER" // or "VENDOR"
}

RESPONSE: 201 Created
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "id": "uuid-xxx",
    "email": "user@example.com",
    "phone": "+2348012345678",
    "first_name": "John",
    "last_name": "Doe",
    "account_type": "USER",
    "is_verified": false,
    "created_at": "2026-05-06T10:30:00Z"
  }
}
```

### 2. Email Verification
```
POST /v1/auth/verify-email
Content-Type: application/json

REQUEST:
{
  "email": "user@example.com",
  "verification_code": "123456"
}

RESPONSE: 200 OK
{
  "success": true,
  "message": "Email verified successfully"
}
```

### 3. Login
```
POST /v1/auth/login
Content-Type: application/json

REQUEST:
{
  "email": "user@example.com",
  "password": "SecurePass123"
}

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "refresh_token_xxx",
    "user": {
      "id": "uuid-xxx",
      "email": "user@example.com",
      "first_name": "John",
      "account_type": "USER",
      "profile_picture": "https://..."
    },
    "expires_in": 86400 // seconds (24 hours)
  }
}
```

### 4. Refresh Token
```
POST /v1/auth/refresh
Content-Type: application/json

REQUEST:
{
  "refresh_token": "refresh_token_xxx"
}

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "access_token": "new_jwt_token",
    "expires_in": 86400
  }
}
```

### 5. Logout
```
POST /v1/auth/logout
Authorization: Bearer [access_token]

RESPONSE: 200 OK
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 👤 User Endpoints

### 6. Get User Profile
```
GET /v1/users/profile
Authorization: Bearer [access_token]

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "email": "user@example.com",
    "phone": "+2348012345678",
    "first_name": "John",
    "last_name": "Doe",
    "profile_picture": "https://...",
    "bio": "Love planning events",
    "account_type": "USER",
    "is_verified": true,
    "created_at": "2026-05-06T10:30:00Z"
  }
}
```

### 7. Update User Profile
```
PUT /v1/users/profile
Authorization: Bearer [access_token]
Content-Type: application/json

REQUEST:
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+2348012345678",
  "bio": "Professional event organizer",
  "profile_picture": "base64_encoded_image"
}

RESPONSE: 200 OK
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { ...updated_user_data }
}
```

### 8. Get User's Events
```
GET /v1/users/events?page=1&limit=10
Authorization: Bearer [access_token]

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "uuid-xxx",
        "event_name": "Wedding Ceremony",
        "event_type": "Wedding",
        "event_date": "2026-06-15",
        "event_location": "Lagos, Nigeria",
        "budget": 5000000,
        "guest_count": 500,
        "status": "PLANNING",
        "created_at": "2026-05-06T10:30:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

### 9. Create Event
```
POST /v1/users/events
Authorization: Bearer [access_token]
Content-Type: application/json

REQUEST:
{
  "event_name": "Wedding Ceremony",
  "event_type": "Wedding",
  "event_date": "2026-06-15",
  "event_location": "Lagos, Nigeria",
  "budget": 5000000,
  "guest_count": 500,
  "event_description": "Beautiful wedding ceremony"
}

RESPONSE: 201 Created
{
  "success": true,
  "message": "Event created successfully",
  "data": { ...event_data }
}
```

---

## 🏪 Vendor Endpoints

### 10. Get Vendor Profile
```
GET /v1/vendors/{vendor_id}

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "user_id": "uuid-user",
    "business_name": "Premium Catering Services",
    "business_description": "Professional catering...",
    "service_categories": ["Catering", "Food Service"],
    "coverage_areas": ["Lagos", "Abuja"],
    "rating": 4.7,
    "total_reviews": 45,
    "total_bookings": 120,
    "response_time_hours": 2,
    "profile_picture": "https://...",
    "is_verified": true,
    "verification_date": "2026-04-01T10:30:00Z",
    "created_at": "2026-03-15T10:30:00Z"
  }
}
```

### 11. Complete Vendor Profile (Vendor Registration)
```
POST /v1/vendors/register
Authorization: Bearer [access_token]
Content-Type: multipart/form-data

REQUEST:
{
  "business_name": "Premium Catering Services",
  "business_registration_number": "RC123456789",
  "business_description": "Professional catering services",
  "service_categories": ["Catering", "Food Service"],
  "coverage_areas": ["Lagos", "Abuja"],
  "response_time_hours": 2,
  "bank_account_number": "1234567890",
  "bank_code": "044",
  "kyc_document_type": "BVN",
  "kyc_document_file": [binary_file],
  "business_registration_file": [binary_file],
  "profile_picture": [binary_file]
}

RESPONSE: 201 Created
{
  "success": true,
  "message": "Vendor profile created. Awaiting KYC verification.",
  "data": { ...vendor_data, "is_verified": false }
}
```

### 12. Get Vendor Dashboard
```
GET /v1/vendors/dashboard
Authorization: Bearer [access_token] (Vendor only)

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "total_earnings": 2500000,
    "pending_requests": 5,
    "active_bookings": 3,
    "completed_bookings": 120,
    "average_rating": 4.7,
    "total_reviews": 45,
    "available_balance": 1500000,
    "pending_payout": 500000,
    "last_payout_date": "2026-05-01",
    "response_rate": 95.5,
    "cancellation_rate": 2.3
  }
}
```

---

## 🔍 Service Endpoints

### 13. Get All Services (Browse)
```
GET /v1/services?
  category=Catering&
  location=Lagos&
  min_price=50000&
  max_price=500000&
  min_rating=4&
  page=1&
  limit=20

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "uuid-xxx",
        "vendor_id": "uuid-vendor",
        "service_name": "Corporate Catering",
        "service_category": "Catering",
        "description": "Full service corporate catering...",
        "base_price": 150000,
        "images": ["https://...", "https://..."],
        "vendor": {
          "id": "uuid-vendor",
          "business_name": "Premium Catering",
          "rating": 4.7,
          "total_reviews": 45,
          "profile_picture": "https://..."
        },
        "packages": [
          {
            "package_name": "Standard",
            "package_price": 150000,
            "inclusions": ["Food", "Service"]
          }
        ]
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20
  }
}
```

### 14. Get Service Details
```
GET /v1/services/{service_id}

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "vendor_id": "uuid-vendor",
    "service_name": "Corporate Catering",
    "service_category": "Catering",
    "description": "Full service corporate catering for events",
    "base_price": 150000,
    "images": ["https://...", "https://..."],
    "vendor": {
      "id": "uuid-vendor",
      "business_name": "Premium Catering",
      "rating": 4.7,
      "total_reviews": 45,
      "response_time_hours": 2,
      "coverage_areas": ["Lagos", "Abuja"]
    },
    "packages": [
      {
        "id": "pkg-xxx",
        "package_name": "Standard",
        "package_price": 150000,
        "inclusions": ["Food for 100 guests", "Service staff"],
        "duration": "4 hours"
      }
    ],
    "reviews": [
      {
        "id": "review-xxx",
        "reviewer": "John Doe",
        "rating": 5,
        "comment": "Excellent service!",
        "created_at": "2026-04-20T10:30:00Z"
      }
    ],
    "availability": true
  }
}
```

### 15. Add Service (Vendor only)
```
POST /v1/vendors/services
Authorization: Bearer [access_token] (Vendor only)
Content-Type: multipart/form-data

REQUEST:
{
  "service_name": "Corporate Catering",
  "service_category": "Catering",
  "description": "Full service corporate catering",
  "base_price": 150000,
  "images": [binary_file, binary_file]
}

RESPONSE: 201 Created
{
  "success": true,
  "message": "Service added successfully",
  "data": { ...service_data }
}
```

---

## 📞 Service Request Endpoints

### 16. Create Service Request
```
POST /v1/requests
Authorization: Bearer [access_token] (User only)
Content-Type: application/json

REQUEST:
{
  "event_id": "uuid-event",
  "service_category": "Catering",
  "event_date": "2026-06-15",
  "event_location": "Lagos, Nigeria",
  "event_description": "Wedding reception for 500 guests",
  "budget_range": {
    "min": 500000,
    "max": 1000000
  },
  "special_requirements": "Halal certification required",
  "vendor_ids": ["uuid-vendor1", "uuid-vendor2"], // optional: send to specific vendors
  "broadcast": true // optional: broadcast to all vendors in category
}

RESPONSE: 201 Created
{
  "success": true,
  "message": "Service request created successfully",
  "data": {
    "id": "uuid-request",
    "user_id": "uuid-user",
    "event_id": "uuid-event",
    "service_category": "Catering",
    "request_status": "PENDING",
    "responses_received": 0,
    "created_at": "2026-05-06T10:30:00Z"
  }
}
```

### 17. Get Service Requests (For Vendor)
```
GET /v1/vendors/requests?status=PENDING&page=1&limit=20
Authorization: Bearer [access_token] (Vendor only)

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "uuid-request",
        "user_id": "uuid-user",
        "user_name": "John Doe",
        "event_date": "2026-06-15",
        "event_location": "Lagos, Nigeria",
        "budget_range": {
          "min": 500000,
          "max": 1000000
        },
        "special_requirements": "Halal certification required",
        "request_status": "PENDING",
        "created_at": "2026-05-06T10:30:00Z"
      }
    ],
    "total": 5,
    "page": 1
  }
}
```

### 18. Accept/Decline Request (Vendor)
```
POST /v1/vendors/requests/{request_id}/respond
Authorization: Bearer [access_token] (Vendor only)
Content-Type: application/json

REQUEST:
{
  "action": "ACCEPT", // or "DECLINE"
  "quote_amount": 750000,
  "quote_message": "We can provide excellent catering service for your event",
  "proposed_date": "2026-06-15"
}

RESPONSE: 200 OK
{
  "success": true,
  "message": "Request accepted successfully",
  "data": {
    "id": "uuid-request",
    "request_status": "ACCEPTED",
    "accepted_at": "2026-05-06T10:35:00Z"
  }
}
```

---

## 💳 Booking & Payment Endpoints

### 19. Create Booking
```
POST /v1/bookings
Authorization: Bearer [access_token] (User only)
Content-Type: application/json

REQUEST:
{
  "request_id": "uuid-request",
  "vendor_id": "uuid-vendor",
  "service_id": "uuid-service",
  "package_id": "pkg-xxx",
  "special_requirements": "Extra staff needed",
  "payment_method": "CARD" // or "BANK_TRANSFER", "WALLET"
}

RESPONSE: 201 Created
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": "uuid-booking",
    "user_id": "uuid-user",
    "vendor_id": "uuid-vendor",
    "booking_status": "PENDING_PAYMENT",
    "booking_amount": 750000,
    "payment_status": "PENDING",
    "created_at": "2026-05-06T10:30:00Z"
  }
}
```

### 20. Initialize Payment
```
POST /v1/payments/initialize
Authorization: Bearer [access_token]
Content-Type: application/json

REQUEST:
{
  "booking_id": "uuid-booking",
  "amount": 750000,
  "payment_method": "CARD",
  "email": "user@example.com",
  "phone": "+2348012345678"
}

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "access_code_xxx",
    "reference": "payment_ref_xxx"
  }
}
```

### 21. Verify Payment
```
POST /v1/payments/verify
Authorization: Bearer [access_token]
Content-Type: application/json

REQUEST:
{
  "reference": "payment_ref_xxx"
}

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "payment_status": "COMPLETED",
    "amount": 750000,
    "booking_id": "uuid-booking",
    "transaction_date": "2026-05-06T10:35:00Z"
  }
}
```

### 22. Get Booking Details
```
GET /v1/bookings/{booking_id}
Authorization: Bearer [access_token]

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "id": "uuid-booking",
    "user_id": "uuid-user",
    "vendor_id": "uuid-vendor",
    "service_id": "uuid-service",
    "booking_status": "CONFIRMED",
    "booking_amount": 750000,
    "payment_status": "COMPLETED",
    "payment_method": "CARD",
    "event_date": "2026-06-15",
    "special_requirements": "Extra staff needed",
    "created_at": "2026-05-06T10:30:00Z",
    "user": { ...user_details },
    "vendor": { ...vendor_details }
  }
}
```

---

## ⭐ Review Endpoints

### 23. Create Review
```
POST /v1/reviews
Authorization: Bearer [access_token]
Content-Type: multipart/form-data

REQUEST:
{
  "booking_id": "uuid-booking",
  "rating": 5,
  "comment": "Excellent catering service! Highly recommended.",
  "images": [binary_file, binary_file]
}

RESPONSE: 201 Created
{
  "success": true,
  "message": "Review created successfully",
  "data": {
    "id": "uuid-review",
    "booking_id": "uuid-booking",
    "rating": 5,
    "comment": "Excellent catering service! Highly recommended.",
    "reviewer_name": "John Doe",
    "created_at": "2026-05-06T10:30:00Z"
  }
}
```

### 24. Get Vendor Reviews
```
GET /v1/vendors/{vendor_id}/reviews?page=1&limit=10

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "uuid-review",
        "reviewer_name": "John Doe",
        "rating": 5,
        "comment": "Excellent service!",
        "images": ["https://...", "https://..."],
        "created_at": "2026-05-06T10:30:00Z"
      }
    ],
    "total": 45,
    "average_rating": 4.7,
    "rating_distribution": {
      "5": 35,
      "4": 8,
      "3": 2,
      "2": 0,
      "1": 0
    }
  }
}
```

---

## 💬 Messaging Endpoints

### 25. Send Message
```
POST /v1/messages
Authorization: Bearer [access_token]
Content-Type: multipart/form-data

REQUEST:
{
  "recipient_id": "uuid-user",
  "message_text": "Hi, I'm interested in your catering service",
  "attachment": [binary_file] // optional
}

RESPONSE: 201 Created
{
  "success": true,
  "data": {
    "id": "uuid-message",
    "sender_id": "uuid-user",
    "recipient_id": "uuid-user",
    "message_text": "Hi, I'm interested in your catering service",
    "is_read": false,
    "created_at": "2026-05-06T10:30:00Z"
  }
}
```

### 26. Get Conversations
```
GET /v1/messages/conversations?page=1&limit=20
Authorization: Bearer [access_token]

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "uuid-conversation",
        "other_user_id": "uuid-user",
        "other_user_name": "Premium Catering",
        "other_user_picture": "https://...",
        "last_message": "Thank you for your inquiry",
        "last_message_at": "2026-05-06T10:30:00Z",
        "unread_count": 2
      }
    ],
    "total": 5
  }
}
```

### 27. Get Conversation Messages
```
GET /v1/messages/conversation/{user_id}?page=1&limit=50
Authorization: Bearer [access_token]

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid-message",
        "sender_id": "uuid-user1",
        "sender_name": "John Doe",
        "message_text": "Hi, interested in your catering",
        "created_at": "2026-05-06T10:30:00Z",
        "is_read": true
      }
    ],
    "total": 15,
    "page": 1
  }
}
```

---

## 👨‍⚖️ Admin Endpoints

### 28. Get Admin Dashboard
```
GET /v1/admin/dashboard
Authorization: Bearer [admin_token]

RESPONSE: 200 OK
{
  "success": true,
  "data": {
    "platform_stats": {
      "total_users": 5000,
      "total_vendors": 800,
      "total_bookings": 3500,
      "total_revenue": 125000000,
      "active_bookings": 150,
      "pending_vendors": 25
    },
    "recent_transactions": [...],
    "top_vendors": [...],
    "daily_signups": {...}
  }
}
```

### 29. Verify Vendor KYC
```
POST /v1/admin/vendors/{vendor_id}/verify
Authorization: Bearer [admin_token]
Content-Type: application/json

REQUEST:
{
  "status": "APPROVED", // or "REJECTED"
  "notes": "KYC verification completed successfully"
}

RESPONSE: 200 OK
{
  "success": true,
  "message": "Vendor verification updated",
  "data": { ...vendor_data }
}
```

### 30. Manage Disputes
```
POST /v1/admin/disputes/{dispute_id}/resolve
Authorization: Bearer [admin_token]
Content-Type: application/json

REQUEST:
{
  "resolution": "Full refund to user",
  "notes": "Vendor failed to provide service"
}

RESPONSE: 200 OK
{
  "success": true,
  "message": "Dispute resolved",
  "data": { ...dispute_data }
}
```

---

## 📊 Response Format

### Success Response (200, 201)
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response (4xx, 5xx)
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Email already exists"
    }
  ],
  "status_code": 400
}
```

---

## 🔑 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid/missing authentication |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limited |
| 500 | Server Error - Internal error |

---

## 🔐 Authentication Header
All protected endpoints require:
```
Authorization: Bearer [JWT_TOKEN]
```

---

## 📝 Pagination

For endpoints returning lists:
```
GET /v1/resource?page=1&limit=20&sort_by=created_at&sort_order=DESC

Response includes:
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "total_pages": 8
}
```

---

**API Version:** 1.0  
**Last Updated:** May 6, 2026
