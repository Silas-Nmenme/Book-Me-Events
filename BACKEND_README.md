# Book Me Events - Backend API

A comprehensive multi-vendor event services marketplace backend built with Node.js, Express, and MongoDB.

## 📋 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Running the Server](#running-the-server)
- [API Documentation](#api-documentation)
- [Database Models](#database-models)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Future Enhancements](#future-enhancements)

## ✨ Features

### User Features
- User registration and authentication
- Browse vendors and services
- Send service requests
- Make bookings and payments
- Rate and review services
- Direct messaging with vendors
- Track booking history

### Vendor Features
- Create and manage vendor profile
- List and manage services
- Accept/decline service requests
- Track bookings and earnings
- Respond to reviews
- View performance metrics
- Manage vendor documents and verification

### Admin Features
- Vendor verification and approval
- User management and account control
- Platform statistics and analytics
- Payment monitoring
- Issue resolution and support
- Announcements and notifications

## 📁 Project Structure

```
src/
├── app.js                      # Express app configuration
├── server.js                   # Server entry point
├── config/
│   └── db.js                  # MongoDB connection
├── controllers/               # Business logic
│   ├── authController.js
│   ├── userController.js
│   ├── vendorController.js
│   ├── serviceController.js
│   ├── requestController.js
│   ├── bookingController.js
│   ├── paymentController.js
│   ├── reviewController.js
│   ├── messageController.js
│   └── adminController.js
├── models/                    # Database schemas
│   ├── User.js
│   ├── Vendor.js
│   ├── Service.js
│   ├── Request.js
│   ├── Booking.js
│   ├── Payment.js
│   ├── Review.js
│   └── Message.js
├── routes/                    # API endpoints
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── vendorRoutes.js
│   ├── serviceRoutes.js
│   ├── requestRoutes.js
│   ├── bookingRoutes.js
│   ├── paymentRoutes.js
│   ├── reviewRoutes.js
│   ├── messageRoutes.js
│   └── adminRoutes.js
├── middlewares/               # Custom middleware
│   ├── authMiddleware.js
│   └── errorMiddleware.js
└── utils/
    └── generateToken.js       # JWT token generation
```

## 🚀 Installation

### Prerequisites
- Node.js (v14+)
- npm or yarn
- MongoDB (local or cloud)

### Steps

1. **Clone the repository:**
   ```bash
   cd "Book Me Events"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Update .env with your configuration**

## ⚙️ Environment Setup

Create a `.env` file in the root directory:

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/book_me_events

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRE=7d

# Server
PORT=5000
NODE_ENV=development

# Optional: Payment gateways, Email, Cloud storage
```

## ▶️ Running the Server

### Development Mode
```bash
npm run dev
```
The server will automatically restart on file changes (requires nodemon).

### Production Mode
```bash
npm start
```

Server runs on `http://localhost:5000`

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer {token}
```

### Response Format
Success Response:
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

Error Response:
```json
{
  "success": false,
  "message": "Error description",
  "stack": "(development only)"
}
```

### Key Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user (protected)
- `POST /auth/logout` - User logout (protected)

#### Users
- `GET /users/:id` - Get user profile
- `PUT /users/:id` - Update profile
- `GET /users/:id/bookings` - Get user bookings
- `GET /users/:id/requests` - Get user requests

#### Vendors
- `GET /vendors` - List all vendors
- `GET /vendors/:id` - Get vendor profile
- `POST /vendors` - Create vendor profile
- `GET /vendors/:id/services` - Get vendor services
- `GET /vendors/:id/reviews` - Get vendor reviews

#### Services
- `GET /services` - List all services (with search/filter)
- `POST /services` - Create service (vendor only)
- `PUT /services/:id` - Update service
- `DELETE /services/:id` - Delete service

#### Requests
- `POST /requests` - Create service request (user)
- `GET /requests/:id` - Get request details
- `PUT /requests/:id/accept` - Accept request (vendor)
- `PUT /requests/:id/decline` - Decline request (vendor)

#### Bookings
- `POST /bookings` - Create booking (user)
- `GET /bookings/:id` - Get booking details
- `PUT /bookings/:id/cancel` - Cancel booking
- `PUT /bookings/:id/complete` - Mark complete (vendor)

#### Payments
- `POST /payments` - Process payment (user)
- `GET /payments/:id` - Get payment details
- `POST /payments/:id/refund` - Request refund

#### Reviews
- `POST /reviews` - Create review (user)
- `GET /reviews` - List reviews
- `PUT /reviews/:id` - Update review
- `PUT /reviews/:id/vendor-response` - Vendor response

#### Messages
- `GET /messages` - List messages
- `POST /messages` - Send message
- `GET /messages/conversation/:userId` - Get conversation

#### Admin
- `GET /admin/dashboard` - Dashboard stats
- `GET /admin/vendors/pending` - Pending vendors
- `PUT /admin/vendors/:id/verify` - Verify vendor
- `GET /admin/stats` - Platform statistics

## 🗄️ Database Models

### User
- Email, phone, password (hashed)
- First name, last name
- Role (USER, VENDOR, ADMIN)
- Verification and active status
- Profile picture and bio

### Vendor
- Business name and registration number
- Bank account details
- Service categories and coverage areas
- Rating and reviews count
- Verification status
- Profile completion percentage

### Service
- Service name and category
- Description and images
- Base price and currency
- Availability status
- Featured flag

### Booking
- References to user, vendor, service
- Event date and location
- Total amount and payment status
- Booking lifecycle status
- Special requests and cancellation info

### Payment
- Amount and currency
- Payment method (Bank transfer, card, etc.)
- Transaction reference
- Payment gateway reference
- Refund tracking

### Review
- Rating (1-5) and title
- Comment and photos
- Verification flag
- Helpful/unhelpful counts
- Vendor response

### Message
- Sender and recipient
- Message content and attachments
- Read status and timestamp
- Conversation ID

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. Register/Login returns a token
2. Include token in `Authorization: Bearer {token}` header
3. Token expires after 7 days (configurable)
4. Refresh token logic can be added for long-lived sessions

### User Roles
- **USER** - Event organizers
- **VENDOR** - Service providers
- **ADMIN** - Platform administrators

## ❌ Error Handling

The API uses Express async handler for error management:
- All controller errors are caught and passed to error middleware
- Consistent error response format
- HTTP status codes properly set
- Detailed error messages in development

## 🚧 Future Enhancements

- [ ] Payment gateway integration (Paystack, Flutterwave)
- [ ] Email notifications (nodemailer)
- [ ] SMS notifications
- [ ] File upload to cloud (Cloudinary)
- [ ] Real-time notifications (Socket.io)
- [ ] Advanced search and filtering
- [ ] Analytics dashboard
- [ ] Rate limiting and security improvements
- [ ] API documentation (Swagger)
- [ ] Unit and integration tests

## 📝 License

This project is licensed under ISC License.

## 👨‍💻 Author

Book Me Events Development Team

---

**Happy Coding! 🎉**
