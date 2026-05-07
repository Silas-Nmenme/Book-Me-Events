# 🚀 Book Me Events - Setup & Getting Started Guide

## 📦 Prerequisites

Before starting development, ensure you have installed:

- **Node.js** (v18.0.0 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/)
- **Redis** (optional, for caching) - [Download](https://redis.io/)
- **Git** - [Download](https://git-scm.com/)
- **VS Code** (recommended) - [Download](https://code.visualstudio.com/)
- **Postman** (for API testing) - [Download](https://www.postman.com/)

---

## 🗂️ Project Setup

### Step 1: Initialize Backend

```bash
# Navigate to project directory
cd "BOOK ME EVENTS"

# Create backend directory
mkdir backend
cd backend

# Initialize Node.js project (if not already done)
npm init -y

# Install essential dependencies
npm install express cors dotenv bcryptjs jsonwebtoken axios

# Install dev dependencies
npm install --save-dev nodemon

# Create project structure
mkdir src
mkdir src/config
mkdir src/models
mkdir src/routes
mkdir src/controllers
mkdir src/middlewares
mkdir src/utils
mkdir src/services
```

### Step 2: Create Environment File

Create `backend/.env`:
```bash
# Server
PORT=5000
NODE_ENV=development
BASE_URL=http://localhost:5000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=book_me_events
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=24h
JWT_REFRESH_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRE=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Email Service
SENDGRID_API_KEY=your_sendgrid_key
EMAIL_FROM=noreply@bookmeevents.com

# SMS Service
TERMII_API_KEY=your_termii_key
TERMII_SENDER_ID=BookMeEvents

# Payment Gateway
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
FLUTTERWAVE_SECRET_KEY=your_flutterwave_key

# AWS/Cloud Storage
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=book-me-events-bucket
AWS_REGION=eu-west-1

# Admin
ADMIN_EMAIL=admin@bookmeevents.com
ADMIN_PASSWORD=secure_password

# File Upload
MAX_FILE_SIZE=10485760 # 10MB in bytes
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf

# Commission
PLATFORM_COMMISSION_RATE=10 # percentage

# Pagination
DEFAULT_PAGE_LIMIT=20
MAX_PAGE_LIMIT=100
```

### Step 3: Initialize Frontend

```bash
# Navigate to project root
cd ../

# Create frontend directory
npx create-react-app frontend
# OR for Next.js
npx create-next-app@latest frontend

cd frontend

# Install essential packages
npm install axios react-router-dom zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

cd ..
```

### Step 4: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE book_me_events;

# Connect to database
\c book_me_events

# Create schema file (we'll use migrations later)
```

---

## 📁 Backend File Structure Setup

### Create main app file: `backend/src/app.js`

```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// API Routes (will be added)
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/users', userRoutes);
// etc...

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
```

### Create server file: `backend/server.js`

```javascript
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
```

### Update `backend/package.json` scripts:

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "test": "jest --coverage",
  "lint": "eslint src/"
}
```

---

## 🗄️ Database Setup

### Create migration tool (use Sequelize or raw SQL)

#### Option A: Using PostgreSQL CLI

Create `backend/src/database/init.sql`:

```sql
-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_picture TEXT,
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('USER', 'VENDOR', 'ADMIN')),
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendors Table
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  business_registration_number VARCHAR(100) UNIQUE,
  tax_id VARCHAR(100),
  bank_account VARCHAR(100),
  business_description TEXT,
  service_categories TEXT[],
  coverage_areas TEXT[],
  response_time_hours INTEGER DEFAULT 24,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_date TIMESTAMP,
  rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  profile_completion_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Continue with other tables...
-- Services, Bookings, Payments, Reviews, etc.
```

Run:
```bash
psql -U postgres -d book_me_events -f backend/src/database/init.sql
```

#### Option B: Using ORM (Sequelize recommended)

```bash
npm install sequelize pg pg-hstore
npm install --save-dev sequelize-cli

# Initialize Sequelize
npx sequelize-cli init
```

---

## 🔐 API Testing Setup

### Create Postman Collection

1. Open Postman
2. Create new Collection: "Book Me Events API"
3. Add folders: Auth, Users, Vendors, Services, Bookings, etc.
4. Create sample requests for each endpoint

Example Authentication Request:
```
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

---

## 🎯 First API Endpoint: Authentication

### Create `backend/src/routes/auth.js`

```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

module.exports = router;
```

### Create `backend/src/controllers/authController.js`

```javascript
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Placeholder - Will connect to database
const users = new Map(); // Temporary in-memory storage

exports.register = async (req, res) => {
  try {
    const { email, password, first_name, last_name, account_type } = req.body;

    // Validation
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if user exists
    if (users.has(email)) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = Date.now().toString();
    users.set(email, {
      id: userId,
      email,
      password_hash: hashedPassword,
      first_name,
      last_name,
      account_type: account_type || 'USER',
      is_verified: false
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        id: userId,
        email,
        first_name,
        last_name,
        account_type: account_type || 'USER'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = users.get(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const token = jwt.sign(
      { id: user.id, email: user.email, type: user.account_type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      success: true,
      data: {
        access_token: token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          account_type: user.account_type
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

exports.verifyEmail = (req, res) => {
  res.json({ success: true, message: 'Email verified' });
};

exports.refreshToken = (req, res) => {
  res.json({ success: true, message: 'Token refreshed' });
};

exports.logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};
```

### Update `backend/src/app.js` to include routes

```javascript
const authRoutes = require('./routes/auth');

// ... existing middleware ...

app.use('/api/v1/auth', authRoutes);

// ... rest of code
```

---

## 🧪 Quick Test

```bash
# Start backend
cd backend
npm run dev

# In another terminal, test the API
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

## 📱 Frontend Setup

### Create main layout: `frontend/src/App.jsx`

```javascript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/common/Navigation';
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

function App() {
  return (
    <Router>
      <Navigation />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </Router>
  );
}

export default App;
```

### Create API service: `frontend/src/services/api.js`

```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  register: (data) => api.post('/v1/auth/register', data),
  login: (data) => api.post('/v1/auth/login', data),
  logout: () => api.post('/v1/auth/logout')
};

export default api;
```

---

## ✅ Development Workflow

### Daily Workflow

1. **Start Backend**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend**
   ```bash
   cd frontend
   npm start
   ```

3. **Make Changes**
   - Backend: Changes auto-reload via nodemon
   - Frontend: Changes auto-reload via React

4. **Test API**
   - Use Postman or API client
   - Check browser console for frontend errors

5. **Version Control**
   ```bash
   git add .
   git commit -m "Feature: Add user authentication"
   git push
   ```

---

## 📋 Development Checklist

### Week 1: Foundation
- [ ] Set up backend and frontend structure
- [ ] Configure database and environment
- [ ] Implement authentication (register/login)
- [ ] Create basic user profile pages
- [ ] Set up API documentation

### Week 2: Core Features
- [ ] Vendor registration and KYC
- [ ] Service listing and browsing
- [ ] Basic service request system
- [ ] User profile management
- [ ] Admin panel setup

### Week 3: Advanced Features
- [ ] Payment integration
- [ ] Booking system
- [ ] Rating and review system
- [ ] Messaging system
- [ ] Analytics dashboard

### Week 4: Polish & Deploy
- [ ] Testing and QA
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Deployment preparation
- [ ] Launch

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module 'express'"
```bash
npm install express
```

### Issue: Database connection error
```bash
# Check PostgreSQL is running
# Linux/Mac: brew services start postgresql
# Windows: Services > PostgreSQL
# Verify .env database credentials
```

### Issue: CORS errors
```bash
# Ensure CORS middleware is added
app.use(cors());
```

### Issue: Port already in use
```bash
# Find process using port
lsof -i :5000
# Kill process
kill -9 <PID>
```

---

## 📚 Useful Resources

- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT.io - JWT Information](https://jwt.io/)
- [Paystack API Docs](https://paystack.com/docs/api/)
- [Rest API Best Practices](https://restfulapi.net/)

---

## 📞 Support

For issues or questions:
1. Check the documentation in this project
2. Review the API specification
3. Check console logs and error messages
4. Search in existing issues

---

**Setup Guide Version:** 1.0  
**Last Updated:** May 6, 2026  
**Status:** Ready for Development ✅
