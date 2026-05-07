# 🏗️ Book Me Events - System Architecture & Flows

## 📡 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React/Next.js)  │  Mobile App  │  Admin Dashboard    │
│  • User Interface          │  (Optional)  │  • Analytics         │
│  • Real-time Chat          │              │  • Management        │
│  • Payment Processing      │              │  • Reports           │
└──────────┬──────────────────────┬─────────────────────┬──────────┘
           │                      │                     │
           └──────────────────────┼─────────────────────┘
                    API Gateway / Load Balancer
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────────┬─────────▼────────┬───────────▼──────────┐
│   EXPRESS SERVER │                  │  SOCKET.IO SERVER    │
│   (Backend API)  │ Authentication   │  (Real-time)         │
│   Controllers    │   Services       │  • Messaging         │
│   Routes         │   JWT/OAuth      │  • Notifications     │
│   Middleware     │   Security       │  • Live Updates      │
└────────┬─────────┴──────────────────┴───────────┬──────────┘
         │                                        │
    ┌────▼────────────────────────────────────────▼─────┐
    │         SERVICE LAYER                             │
    │  ┌──────────┐ ┌────────────┐ ┌──────────────┐   │
    │  │Auth      │ │Payment     │ │Notification │   │
    │  │Service   │ │Service     │ │Service       │   │
    │  └──────────┘ └────────────┘ └──────────────┘   │
    │  ┌──────────┐ ┌────────────┐ ┌──────────────┐   │
    │  │Analytics │ │File Upload │ │Email/SMS     │   │
    │  │Service   │ │Service     │ │Service       │   │
    │  └──────────┘ └────────────┘ └──────────────┘   │
    └────────┬───────────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │         DATABASE LAYER                        │
    │  ┌──────────────────────────────────────┐    │
    │  │  PostgreSQL (Primary Database)       │    │
    │  │  • Users, Vendors, Services          │    │
    │  │  • Bookings, Payments, Reviews       │    │
    │  │  • Messages, Disputes                │    │
    │  └──────────────────────────────────────┘    │
    │  ┌──────────────────────────────────────┐    │
    │  │  Redis Cache                         │    │
    │  │  • Session management                │    │
    │  │  • Frequently accessed data           │    │
    │  │  • Rate limiting                     │    │
    │  └──────────────────────────────────────┘    │
    └────────────────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │      EXTERNAL INTEGRATIONS                    │
    │  ┌──────────┐ ┌────────┐ ┌────────────┐     │
    │  │Paystack/ │ │AWS S3/ │ │SendGrid/   │     │
    │  │Flutterwave
 │ │CloudinAry│ │Termii/SMS │     │
    │  │Payment   │ │Storage │ │Email       │     │
    │  └──────────┘ └────────┘ └────────────┘     │
    │  ┌──────────┐ ┌────────┐ ┌────────────┐     │
    │  │Google    │ │Firebase│ │Sentry      │     │
    │  │Maps      │ │Push    │ │Monitoring  │     │
    │  └──────────┘ └────────┘ └────────────┘     │
    └────────────────────────────────────────────┘
```

---

## 🔄 User Journey Flows

### **1. Vendor Signup & Onboarding Flow**

```
START
  │
  ├─► Vendor Registration
  │   • Email/Phone verification
  │   • Password setup
  │
  ├─► Basic Profile Creation
  │   • Business name
  │   • Business type/category
  │   • Coverage areas
  │
  ├─► KYC Verification
  │   • Upload ID (Driver's License, BVN, NIN)
  │   • Upload Business Registration
  │   • Upload Tax ID
  │   • Bank Account Details
  │
  ├─► Service Setup
  │   • Add services
  │   • Set pricing
  │   • Upload portfolio (photos/videos)
  │   • Set availability
  │
  ├─► Admin Review
  │   [PENDING] → [APPROVED/REJECTED]
  │
  └─► Account Activated ✓
      • Can receive service requests
      • Can interact with users
      • Access to dashboard
```

### **2. User Booking Flow**

```
START
  │
  ├─► User Creates Account
  │   • Registration & verification
  │
  ├─► Create Event
  │   • Event name, date, type
  │   • Location, budget
  │   • Guest count
  │
  ├─► Browse Services
  │   • View vendors by category
  │   • Filter by price, rating, location
  │   • View vendor portfolios
  │
  ├─► Send Service Request
  │   • Select vendor OR broadcast to category
  │   • Specify requirements
  │   • Set budget
  │   • Add special notes
  │
  ├─► Vendor Response
  │   [PENDING] → [ACCEPTED/DECLINED]
  │
  ├─► Negotiation (if needed)
  │   • Chat with vendor
  │   • Discuss terms
  │   • Finalize details
  │
  ├─► Payment
  │   • View quote/invoice
  │   • Choose payment method
  │   • Pay deposit or full amount
  │   • Get payment confirmation
  │
  ├─► Service Delivery
  │   • Vendor performs service
  │   • User confirms completion
  │
  ├─► Review & Rating
  │   • Leave vendor rating
  │   • Write review
  │   • Upload photos
  │
  └─► Event Complete ✓
```

### **3. Admin Monitoring Flow**

```
ADMIN DASHBOARD
  │
  ├─► Platform Overview
  │   • Total users
  │   • Active vendors
  │   • Daily bookings
  │   • Revenue metrics
  │
  ├─► Vendor Management
  │   • Review pending vendors
  │   • Verify KYC documents
  │   • Approve/Reject/Block
  │   • Monitor vendor performance
  │
  ├─► User Management
  │   • View user activity
  │   • Handle complaints
  │   • Block suspicious accounts
  │
  ├─► Transaction Monitoring
  │   • View all payments
  │   • Track commissions
  │   • Process vendor payouts
  │   • Handle refunds
  │
  ├─► Dispute Resolution
  │   • Review disputes
  │   • Mediate conflicts
  │   • Release funds
  │   • Apply penalties if needed
  │
  ├─► Reports & Analytics
  │   • Revenue reports
  │   • User growth
  │   • Vendor performance
  │   • Service utilization
  │
  └─► System Settings
      • Commission rates
      • Verification requirements
      • Platform rules
```

---

## 💳 Payment Flow

```
USER INITIATES PAYMENT
  │
  ├─► Amount Breakdown
  │   • Service fee: 100,000 NGN
  │   • Platform commission (10%): 10,000 NGN
  │   • Total: 110,000 NGN
  │
  ├─► Payment Gateway Selection
  │   • Paystack
  │   • Flutterwave
  │   • Bank Transfer
  │
  ├─► Payment Processing
  │   │
  │   ├─ Card/Transfer Details
  │   ├─ Amount Verification
  │   └─ Process Payment
  │
  ├─► Payment Status
  │   ├─ SUCCESS ────┐
  │   ├─ FAILED ──┐  │
  │   └─ PENDING  │  │
  │               │  │
  │   ┌───────────┘  │
  │   │              │
  │   ├─► Mark Booking as PAID
  │   │
  │   ├─► Store Transaction
  │   │   • Reference number
  │   │   • Amount
  │   │   • Commission
  │   │   • Vendor amount: 90,000 NGN
  │   │
  │   ├─► Send Confirmations
  │   │   • Email receipt to user
  │   │   • Notify vendor
  │   │   • Update dashboard
  │   │
  │   └─► Schedule Vendor Payout
  │       • Within 7 days
  │       • Direct to bank
  │       • Generate payout report
  │
  └─► COMPLETE ✓
```

---

## 📨 Notification System Flow

```
EVENT TRIGGERED
  │
  ├─► New Service Request
  │   ├─ In-app notification to vendor
  │   ├─ Email to vendor
  │   └─ SMS (if opted)
  │
  ├─► Request Accepted
  │   ├─ In-app notification to user
  │   ├─ Email confirmation
  │   └─ Booking details
  │
  ├─► Payment Received
  │   ├─ Receipt to user
  │   ├─ Payout notification to vendor
  │   └─ Admin report
  │
  ├─► Service Date Approaching
  │   ├─ Reminder to both parties
  │   ├─ Confirm final details
  │   └─ Share contact info
  │
  ├─► Service Completed
  │   ├─ Prompt user to review
  │   ├─ Notify vendor
  │   └─ Release funds
  │
  └─► Messages/Chat
      ├─ New message alert
      ├─ Desktop notification
      └─ Email digest option
```

---

## 🔐 Authentication & Authorization Flow

```
LOGIN REQUEST
  │
  ├─► Email/Phone + Password
  │   │
  │   ├─► Database Query (User exists?)
  │   │   ├─ User not found → ERROR
  │   │   └─ User found ──┐
  │   │                    │
  │   ├─► Password Verification (bcrypt)
  │   │   ├─ Invalid → ERROR + Lock attempts
  │   │   └─ Valid ──┐
  │   │              │
  │   ├─► Generate JWT Token
  │   │   • Header: alg, typ
  │   │   • Payload: user_id, role, exp (24h)
  │   │   • Signature: Encrypted with secret key
  │   │
  │   ├─► Store Session
  │   │   • Redis cache
  │   │   • User activity log
  │   │
  │   ├─► Generate Refresh Token
  │   │   • Stored in HTTPOnly cookie
  │   │   • 7-day expiration
  │   │
  │   └─► Send Response
  │       • Access token (JWT)
  │       • Refresh token
  │       • User details
  │       • Role (USER/VENDOR/ADMIN)
  │
  ├─► Subsequent Requests
  │   ├─ Include Authorization header: "Bearer [token]"
  │   │
  │   ├─ Middleware Verification
  │   │   ├─ Token exists?
  │   │   ├─ Token valid?
  │   │   ├─ Token expired?
  │   │   └─ User role authorized?
  │   │
  │   ├─ Access Granted ✓
  │   └─ Access Denied (401/403)
  │
  └─► Logout
      ├─ Invalidate JWT
      ├─ Clear session
      └─ Clear refresh token
```

---

## 📊 Search & Filter Flow

```
USER SEARCHES FOR SERVICES
  │
  ├─► Input Filters
  │   ├─ Service Category (Caterer, DJ, etc.)
  │   ├─ Location/Coverage Area
  │   ├─ Price Range (10K - 500K)
  │   ├─ Min Rating (4.5 stars)
  │   ├─ Availability (Date range)
  │   └─ Keyword search
  │
  ├─► Build Query
  │   ├─ Validate input
  │   ├─ Sanitize search term
  │   └─ Create SQL WHERE clause
  │
  ├─► Execute Search
  │   │
  │   ├─ Check Redis Cache
  │   │   ├─ Cache HIT → Return cached results (fast!)
  │   │   └─ Cache MISS → Query database
  │   │
  │   ├─ Database Query
  │   │   ├─ Filter vendors by criteria
  │   │   ├─ Calculate ratings
  │   │   ├─ Sort by relevance
  │   │   └─ Paginate (20 per page)
  │   │
  │   └─ Store in Cache (5 minutes)
  │
  ├─► Enrich Results
  │   ├─ Add vendor photos
  │   ├─ Add top 3 reviews
  │   ├─ Add response time
  │   └─ Add total bookings
  │
  └─► Return Results
      ├─ Display on frontend
      ├─ Show filters applied
      ├─ Provide pagination
      └─ Allow sorting/refining
```

---

## 🚀 Deployment Architecture

```
DEVELOPMENT
  ├─ Local Machine
  └─ Git Repository

GIT PUSH
  └─ GitHub Repository

CONTINUOUS INTEGRATION (GitHub Actions)
  ├─ Run Tests
  ├─ Lint Code
  ├─ Build Application
  └─ Run Security Scan

STAGING ENVIRONMENT
  ├─ Deploy to staging server
  ├─ Run Integration Tests
  ├─ Test Payment Gateway
  └─ Verify Notifications

PRODUCTION ENVIRONMENT
  ├─ AWS/Heroku/DigitalOcean
  │  ├─ Load Balancer (Nginx)
  │  ├─ Express Servers (Multiple instances)
  │  ├─ PostgreSQL Database (RDS)
  │  ├─ Redis Cache
  │  └─ Storage (S3/Cloudinary)
  │
  ├─ CDN (Cloudflare)
  │  └─ Static assets, caching
  │
  ├─ Monitoring (Sentry, New Relic)
  │  ├─ Error tracking
  │  ├─ Performance monitoring
  │  └─ Uptime monitoring
  │
  └─ Backup & Recovery
     ├─ Daily automated backups
     ├─ Point-in-time restore
     └─ Disaster recovery plan
```

---

## 📈 Scalability Strategy

### **Horizontal Scaling**
- Multiple Express server instances
- Load balancing with Nginx
- Database read replicas
- Separate Redis clusters

### **Vertical Scaling**
- Upgrade server resources
- Optimize database queries
- Implement caching strategies
- CDN for static content

### **Database Optimization**
- Proper indexing
- Query optimization
- Archive old data
- Partitioning large tables

### **API Rate Limiting**
- User tier-based limits
- Exponential backoff
- Request queuing
- DDoS protection

---

## 🛡️ Security Layers

```
REQUEST FLOW SECURITY
         │
         ├─► DDoS Protection (Cloudflare)
         │
         ├─► HTTPS/TLS Encryption
         │
         ├─► Rate Limiting
         │   • Per IP address
         │   • Per user
         │   • Per API endpoint
         │
         ├─► Input Validation & Sanitization
         │   • Remove XSS payloads
         │   • Prevent SQL injection
         │   • Validate data types
         │
         ├─► Authentication
         │   • JWT verification
         │   • Session validation
         │   • 2FA for vendors
         │
         ├─► Authorization (RBAC)
         │   • Role-based access
         │   • Resource ownership check
         │   • Permission validation
         │
         ├─► Business Logic Security
         │   • Payment verification
         │   • Amount validation
         │   • State machine validation
         │
         ├─► Data Encryption
         │   • Passwords (bcrypt)
         │   • Sensitive data (AES)
         │   • Tokens (JWT)
         │
         └─► Audit Logging
             • All admin actions
             • All transactions
             • Security events
             • User activities
```

---

## 🧪 Testing Strategy

```
UNIT TESTS
├─ Test individual functions
├─ Mock external dependencies
└─ Achieve 80%+ coverage

INTEGRATION TESTS
├─ Test API endpoints
├─ Database interactions
├─ Payment gateway integration
└─ Notification service

END-TO-END TESTS
├─ User signup flow
├─ Complete booking flow
├─ Payment processing
└─ Admin operations

PERFORMANCE TESTS
├─ Load testing
├─ Stress testing
├─ Database query optimization
└─ API response times

SECURITY TESTS
├─ Penetration testing
├─ SQL injection attempts
├─ XSS vulnerability scanning
└─ Authentication bypass attempts
```

---

**Document Version:** 1.0  
**Last Updated:** May 6, 2026
