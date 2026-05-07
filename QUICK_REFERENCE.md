# 🎯 Book Me Events - Quick Reference Card

## 📌 ONE-PAGE OVERVIEW

### What is Book Me Events?
A **multi-vendor event services marketplace** connecting event planners with professional vendors (caterers, DJs, security, decorators, etc.)

### The Business Model
```
Users (Event Organizers)
    ↓ Search & Browse ↓
Services by Vendors
    ↓ Request Service ↓
Vendors Accept/Decline
    ↓ Book & Pay ↓
Service Delivered
    ↓ Rate & Review ↓
Platform Commission (10%)
```

---

## 👥 THREE MAIN ROLES

| User | Vendor | Admin |
|------|--------|-------|
| Browse services | Create profile | Monitor all |
| Request services | Accept/decline requests | Verify vendors |
| Chat with vendors | Manage services | Handle disputes |
| Book & pay | View earnings | View analytics |
| Rate & review | Receive payouts | Manage platform |

---

## 🔑 KEY FEATURES

### Must-Have (MVP)
- ✅ User registration & login
- ✅ Vendor registration with KYC
- ✅ Service browsing
- ✅ Service requests
- ✅ Messaging
- ✅ Payment processing
- ✅ Basic admin dashboard

### Nice-to-Have
- 🟠 Mobile app
- 🟠 Advanced analytics
- 🟠 API for third-parties
- 🟠 Multiple languages

---

## 📱 USER JOURNEYS (Simplified)

### User: "I want to book a caterer for my wedding"
```
1. Sign up → 2. Create event → 3. Search caterers
4. View details & reviews → 5. Send request → 6. Chat with vendor
7. Get quote → 8. Pay → 9. Confirm booking → 10. Rate service
```

### Vendor: "I want to list my catering service"
```
1. Sign up → 2. Submit KYC docs → 3. Wait for approval
4. Add services → 5. Set prices → 6. Upload portfolio
7. Accept requests → 8. Deliver service → 9. Receive payment
```

### Admin: "Monitor what's happening"
```
1. Dashboard overview → 2. Check pending vendors
3. Verify KYC docs → 4. Handle disputes
5. View analytics → 6. Manage users
```

---

## 💻 TECH STACK (TL;DR)

| Component | Technology |
|-----------|-----------|
| Backend API | Node.js + Express |
| Frontend | React.js |
| Database | PostgreSQL |
| Caching | Redis |
| Real-time | Socket.io |
| Payments | Paystack API |
| File Storage | AWS S3 |
| Hosting | AWS/Heroku |

---

## 🏗️ ARCHITECTURE (Simple View)

```
┌─────────────────┐
│  FRONTEND (Web) │
└────────┬────────┘
         │ HTTP + WebSocket
┌────────▼──────────┐
│ EXPRESS BACKEND   │
├───────────────────┤
│ Routes/Controllers│
│ Business Logic    │
│ Authentication    │
└────────┬──────────┘
         │
    ┌────┴────────┐
    │             │
┌───▼─────┐  ┌───▼──────┐
│PostgreSQL│  │  Redis   │
└──────────┘  └──────────┘

External Services:
├─ Paystack (Payments)
├─ SendGrid (Email)
├─ AWS S3 (Files)
└─ Socket.io (Real-time)
```

---

## 📊 DATABASE CORE TABLES

```
users → vendors, service_requests, bookings, reviews, messages
services → service_packages, reviews, bookings
bookings → payments, reviews, disputes
payments → vendor payouts
messages → conversations
```

**Total:** 13+ tables

---

## 🔌 API ENDPOINTS (30 Total)

### Authentication (5)
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/verify-email
```

### Users (3)
```
GET    /api/v1/users/profile
PUT    /api/v1/users/profile
GET    /api/v1/users/events
```

### Services (5)
```
GET    /api/v1/services
GET    /api/v1/services/{id}
POST   /api/v1/vendors/services
PUT    /api/v1/vendors/services/{id}
DELETE /api/v1/vendors/services/{id}
```

### Bookings & Payments (6)
```
POST   /api/v1/requests
GET    /api/v1/vendors/requests
POST   /api/v1/bookings
GET    /api/v1/payments/initialize
POST   /api/v1/payments/verify
POST   /api/v1/vendors/request-payout
```

### Reviews & Messages (6)
```
POST   /api/v1/reviews
GET    /api/v1/vendors/{id}/reviews
POST   /api/v1/messages
GET    /api/v1/messages/conversations
PUT    /api/v1/notifications/{id}/read
GET    /api/v1/notifications
```

### Admin (5)
```
GET    /api/v1/admin/dashboard
PUT    /api/v1/admin/vendors/{id}/verify
PUT    /api/v1/admin/disputes/{id}/resolve
GET    /api/v1/admin/users
GET    /api/v1/admin/analytics
```

---

## 📈 DEVELOPMENT PHASES (8 Weeks to MVP)

```
Week 1-2: Authentication + User Profiles
    └─ Users can sign up and log in

Week 3-4: Services + Browsing
    └─ Vendors can list services, users can browse

Week 5-6: Requests + Booking
    └─ Users can request services, vendors can accept

Week 7-8: Payments + Admin
    └─ Payments work, admin can monitor

Weeks 9+: Additional features
    └─ Messaging, reviews, mobile, scaling
```

---

## 🚀 QUICK START

### Prerequisites
```bash
Node.js v18+
PostgreSQL
npm/yarn
Git
```

### 5-Minute Setup
```bash
# 1. Clone/initialize
git clone ... && cd backend

# 2. Install dependencies
npm install

# 3. Create .env file
# (Copy values from SETUP_GUIDE.md)

# 4. Start development server
npm run dev

# Server runs on: http://localhost:5000
```

### Test It
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

---

## 💰 REVENUE MODEL

```
Commission per booking: 10% (configurable)

Example Booking:
├─ Service Cost: 1,000,000 NGN
├─ Platform Commission (10%): 100,000 NGN ✓ (Revenue)
└─ Vendor Gets: 900,000 NGN
```

---

## 📊 SUCCESS METRICS

| Milestone | Target | Status |
|-----------|--------|--------|
| MVP Launch | Week 8 | 🔴 Pending |
| 100 Users | Week 12 | 🔴 Pending |
| 50 Vendors | Week 16 | 🔴 Pending |
| 50 Bookings | Week 16 | 🔴 Pending |
| ₦5M Revenue | Month 3 | 🔴 Pending |
| 99.9% Uptime | Month 6 | 🔴 Pending |

---

## 🔐 SECURITY ESSENTIALS

- ✅ HTTPS/SSL encryption
- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ Input validation & sanitization
- ✅ Rate limiting
- ✅ CSRF protection
- ✅ Admin audit logs
- ✅ KYC verification for vendors

---

## 🎨 PAGE MAP

### User Pages
```
/                      Home/Browse Services
/register              Sign Up
/login                 Sign In
/profile               My Profile
/browse                Service Directory
/services/{id}         Service Details
/user/requests         My Service Requests
/user/bookings         My Bookings
/messages              Chat with Vendors
```

### Vendor Pages
```
/vendor/register       Complete Vendor Setup
/vendor/dashboard      Dashboard Overview
/vendor/services       My Services List
/vendor/requests       Incoming Requests
/vendor/bookings       My Bookings
/vendor/earnings       Earnings & Payouts
```

### Admin Pages
```
/admin/dashboard       Platform Overview
/admin/users           User Management
/admin/vendors         Vendor Verification
/admin/analytics       Reports & Analytics
/admin/disputes        Dispute Resolution
```

---

## ⚡ PERFORMANCE TARGETS

```
API Response Time: < 200ms
Page Load Time: < 2 seconds
Database Query: < 100ms
Uptime: 99.9%+
Concurrent Users: 1,000+
```

---

## 📚 DOCUMENTATION FILES

| File | Purpose | When to Read |
|------|---------|--------------|
| PROJECT_PLAN.md | Complete overview | First thing |
| ARCHITECTURE.md | Technical deep-dive | Before coding |
| API_SPECIFICATION.md | Endpoint details | During development |
| SETUP_GUIDE.md | Setup instructions | Getting started |
| DEVELOPMENT_ROADMAP.md | Phase-by-phase plan | Planning sprints |
| README.md | Summary & quickstart | Quick reference |

---

## 🆘 TROUBLESHOOTING

### Server won't start
```bash
# Check if port 5000 is used
lsof -i :5000
# Install dependencies
npm install
```

### Database connection error
```bash
# Check PostgreSQL is running
psql -U postgres
# Verify .env DATABASE_URL
```

### CORS errors
```bash
# Make sure CORS middleware is added
app.use(cors());
```

---

## 💡 PRO TIPS

1. **Start with Phase 1**: Don't add extra features too soon
2. **Test as you go**: Use Postman for API testing
3. **Use Git**: Commit after each feature
4. **Read the docs**: Detailed in PROJECT_PLAN.md
5. **Keep it simple**: Complex features can wait
6. **Monitor performance**: Use Sentry early
7. **Test security**: Do penetration testing

---

## 🎯 FIRST MONTH GOALS

- Week 1-2: Authentication working
- Week 3-4: Services can be listed & browsed
- Week 5-6: Requests & booking flow complete
- Week 7-8: Payments integrated, MVP ready

---

## 📞 RESOURCES

- Express Docs: https://expressjs.com/
- React Docs: https://react.dev/
- PostgreSQL: https://www.postgresql.org/
- Paystack: https://paystack.com/docs/
- JWT: https://jwt.io/

---

## ✅ BEFORE YOU START CODING

- [ ] Read PROJECT_PLAN.md
- [ ] Understand all user roles
- [ ] Know the tech stack
- [ ] Have Node.js & PostgreSQL installed
- [ ] Read SETUP_GUIDE.md
- [ ] Create .env file
- [ ] Initialize backend
- [ ] Run first server test

---

**Print this → Keep nearby → Reference constantly** 📋

---

**Quick Reference Version:** 1.0  
**Last Updated:** May 6, 2026  
**Status:** Ready to Build 🚀
