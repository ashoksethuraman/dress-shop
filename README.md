# Dress Shop - Full Stack E-Commerce Application

This repository contains a complete dress shopping platform with:

- React frontend (TypeScript, Redux Toolkit, Tailwind)
- Node.js + Express backend deployed on Firebase Cloud Functions
- Firestore for products, users, orders, and payment metadata
- Firebase Storage for product and banner image uploads
- Razorpay integration for real-time online payments
- Role-based admin panel for product/order/user/content management

The app is designed for both guest and authenticated checkout flows, with secure cookies, CSRF support hooks, and admin-only business operations.

---

## Live Architecture

1. Frontend is hosted on Firebase Hosting.
2. API requests are sent to relative /api routes.
3. Hosting rewrites /api/** to one Cloud Function named api.
4. The function runs an Express app with route modules for products, orders, users, payments, images, and config.
5. Data is stored in Firestore, and images are stored in Firebase Storage.
6. Razorpay is used for payment order creation, verification, webhook validation, and refunds.

---

## Core Features

### Customer Features

- User registration, login, logout (cookie-based JWT session)
- Product listing with pagination (lazy loading) and filters
- Search and product detail pages
- Cart and buy-now checkout flow
- Guest checkout and logged-in checkout
- Razorpay payment flow with verification and webhook handling
- Order summary, order tracking, and order history
- Wishlist and profile management

### Admin Features

- Admin-only product CRUD
- Product image and size chart upload support
- Home banner upload/delete
- Contact content configuration
- View all users and activate/deactivate users
- Promote users to admin role
- View all orders and update lifecycle statuses
- Cancel/refund support with Razorpay integration
- Notification email flow on payment/order events

---

## Tech Stack

- Frontend: React 19, TypeScript, Redux Toolkit, React Router, Tailwind CSS
- Backend: Express on Firebase Functions (TypeScript)
- Database: Firestore
- Storage: Firebase Storage
- Payments: Razorpay
- Email: Nodemailer (SMTP)
- Security: Helmet, CORS allowlist, rate limiting, secure cookie auth

---

## Repository Structure

- client/ -> React frontend
- functions/ -> Cloud Functions backend (Express API)
- scripts/ -> utility scripts (admin claim setup, misc tools)
- firestore.rules -> Firestore security rules
- firestore.indexes.json -> Firestore indexes
- firebase.json -> Hosting/Functions/Emulator config

---

## Prerequisites

Install these before running locally:

- Node.js 20+ (project currently declares Node 24 in functions)
- npm 10+
- Firebase CLI
  - npm install -g firebase-tools
- Firebase project access (default project in this repo: halleycomet-7cd48)

Then authenticate CLI:

firebase login

---

## Installation

Install dependencies in all required folders.

From project root:

npm install

From frontend folder:

cd client
npm install

From functions folder:

cd ../functions
npm install

---

## Environment Configuration

## 1) Frontend Environment

This repo already contains:

- client/.env.example
- client/.env.emulator
- client/.env.production

Recommended setup:

1. Copy client/.env.example to client/.env.local for custom local values.
2. Use npm run start:emulator to load client/.env.emulator automatically.

Frontend variables used by code:

- REACT_APP_FIREBASE_API_KEY
- REACT_APP_FIREBASE_AUTH_DOMAIN
- REACT_APP_FIREBASE_PROJECT_ID
- REACT_APP_FIREBASE_STORAGE_BUCKET
- REACT_APP_FIREBASE_MESSAGING_SENDER_ID
- REACT_APP_FIREBASE_APP_ID
- REACT_APP_USE_EMULATOR
- REACT_APP_RAZORPAY_KEY_ID
- REACT_APP_RECAPTCHA_SITE_KEY (optional)

Notes:

- API base URL is hard-coded to /api in client/src/services/apiClient.ts.
- In emulator mode, client/src/setupProxy.js proxies /api to local Functions emulator.

## 2) Backend Environment (Functions)

Create functions/.env for local emulator/runtime fallback variables:

JWT_SECRET=replace_with_strong_secret
NODE_ENV=development
ENFORCE_RAZORPAY_SIGNATURE=false

RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_test_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

MAIL_SMTP_HOST=smtp.example.com
MAIL_SMTP_PORT=587
MAIL_SMTP_SECURE=false
MAIL_SMTP_USER=example_user
MAIL_SMTP_PASS=example_pass
MAIL_FROM_EMAIL=no-reply@example.com
MAIL_FROM_NAME=Halley Comet

Production secret management (recommended):

firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET

Razorpay keys are loaded via Firebase Secret Manager params first, then process.env fallback.

---

## Running Locally (Emulator + React App)

Use two terminals.

Terminal 1 (root):

firebase emulators:start

Terminal 2 (client):

cd client
npm run start:emulator

Expected local ports from firebase.json:

- Hosting: 5000
- Functions: 5001
- Firestore: 8081
- Auth: 9099
- Emulator UI: 4000
- React dev server: 3000

How local API routing works:

- React app calls /api/...
- setupProxy.js forwards /api to http://127.0.0.1:5001/<projectId>/asia-south1/api

---

## Build and Production Deployment

## 1) Build Frontend

cd client
npm run build

## 2) Build Functions

cd ../functions
npm run build

## 3) Deploy Firestore Rules + Indexes

cd ..
firebase deploy --only firestore

## 4) Deploy Functions + Hosting

firebase deploy --only functions,hosting

The hosting config rewrites /api/** to function api and serves client/build for frontend routes.

---

## API Surface Overview

Base path: /api

Products:

- GET /products
- GET /products/admin (admin)
- GET /products/:id
- POST /products (admin)
- PUT /products/:id (admin)
- DELETE /products/:id (admin)

Orders:

- POST /orders (guest or user)
- GET /orders/track/:id (public tracking)
- GET /orders/id/:id (owner/admin)
- GET /orders/self (user)
- GET /orders (admin)
- POST /orders/:id/status (admin)
- POST /orders/:id/cancel (owner/admin/guest flow)

Payments:

- POST /payments/razorpay-order
- POST /payments/verify
- POST /payments/fail
- POST /payments/refund
- POST /payments/webhook (raw-body endpoint)

Users:

- POST /users/signup
- POST /users/login
- POST /users/logout
- GET /users/csrf-token
- GET /users/me
- POST /users/update-profile
- GET /users/wishlist
- PUT /users/wishlist
- GET /users/cart
- PUT /users/cart
- POST /users/set-admin (admin)
- GET /users/all (admin)
- PATCH /users/status (admin)

Config and Images:

- GET /config
- POST /config (admin, banner upload)
- DELETE /config/banner (admin)
- GET /config/contact
- PUT /config/contact (admin)
- POST /images/upload (admin)

---

## Security and Access Control

- JWT sessions are stored in httpOnly __session cookie.
- CORS allowlist is enforced for known frontend domains.
- Non-browser write requests are blocked by browser-only middleware.
- Rate limiting is enabled globally and per operation groups.
- Admin-only endpoints use middleware role checks.
- Firestore rules include owner/admin checks and public read rules where required.

Important:

- For real production, keep strict secret hygiene and rotate any leaked credentials.
- Do not commit service account JSON files or backend secrets.

---

## Firestore and Data Model

Detailed collection schemas and examples are documented in:

- FIRESTORE_SCHEMA.md

Rules and indexes are in:

- firestore.rules
- firestore.indexes.json

---

## First Admin Setup

Use the one-time bootstrap process documented in:

- SETUP_ADMIN.md

Quick summary:

1. Create/login user from app.
2. Add scripts/serviceAccountKey.json (never commit).
3. Run scripts/setAdmin.js with target email.
4. Sign out and sign in again to refresh claims.

---

## Useful Commands

Root:

- firebase emulators:start
- firebase deploy --only firestore
- firebase deploy --only functions,hosting

Client:

- npm start
- npm run start:emulator
- npm run build

Functions:

- npm run lint
- npm run build
- npm run serve
- npm run deploy
- npm run logs

---

## Troubleshooting

1. API returns 403 in local testing tools (Postman/curl):
	Browser-only middleware blocks non-browser write requests by design.

2. Razorpay verify/refund fails:
	Check RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and webhook secret values.

3. Cookies not sticking locally:
	Use hosting rewrite + same-origin /api flow and start client with emulator mode.

4. Firestore query errors about missing index:
	Deploy firestore.indexes.json again.

5. Admin routes return forbidden:
	Ensure user role is admin and token/session is refreshed after role change.

---

## Additional Project Docs

- FIRESTORE_SCHEMA.md
- SETUP_ADMIN.md
- functions/src/FLOW_ANALYSIS.md
- functions/src/API_FLOW_ANALYSIS.md

---

## License

This project appears to be private/proprietary unless you add an explicit license file.
