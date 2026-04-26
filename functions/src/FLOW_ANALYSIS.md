# E-Commerce Backend Flow Analysis & Fixes

## Overview
This document analyzes the complete e-commerce flow in the Firebase Functions backend and identifies issues that need to be fixed.

---

## 1. Order Creation Flow

```
Client → POST /orders → validateCreateOrder → calculateOrderPricing → Create Order in Firestore
```

### Current Issues Found:
- **Syntax Error** in orders.ts (line ~325): `*` instead of `/*` in comment block
- **Missing Import**: `initiateRefund` used but not imported

### Fix Applied:
```typescript
// In orders.ts - Add this import after emailService import
import { initiateRefund } from "./refund";
```

---

## 2. Payment Flow

### Online Payment (Razorpay)
```
Client → POST /payments/razorpay-order → Create Razorpay Order ID
Client → Complete Payment on Razorpay
Client → POST /payments/verify → Validate Signature → confirmPayment → deductInventory → sendOrderEmail
```

### COD Payment
```
Client → POST /orders (paymentMethod: "cod") → Order Created with status "PLACED"
Client → POST /payments/cod → Update paymentStatus to "PENDING"
```

### Current Issues:
- **Duplicate field** in `toEmailPayload()`: Both `totalAmount` and `amount` are set to the same value

---

## 3. Webhook Flow

```
Razorpay → POST /payments/webhook → razorpayWebhookHandler
                                    → confirmPayment
                                    → deductInventory
                                    → sendOrderEmail
```

### Status: ✅ Already properly configured in app.ts

---

## 4. Inventory Management

```
Payment Confirmed → deductInventory() → Update sizeInventory in Firestore
```

### Current Issues:
- No stock validation during order creation (only deduct after payment)
- Could allow overselling if multiple orders placed simultaneously

---

## 5. Email Notifications

```
Payment Success → sendOrderEmail("payment_success", payload)
Order Cancelled → sendOrderEmail("payment_cancelled", payload)
Refund Processed → sendOrderEmail(...)
```

### Current Issues:
- Email service not initialized properly if env vars missing (silent failure)

---

## 6. User Authentication Flow

```
Signup → POST /users/signup → Validate → Hash Password → Create User → Issue JWT
Login  → POST /users/login  → Validate → Compare Hash → Issue JWT
```

### Current Issues:
- No rate limiting on auth endpoints (vulnerable to brute force)
- JWT secret must be set in environment variables

---

## Critical Fixes Required

### Fix 1: Syntax Error in orders.ts
```typescript
// Line ~325: Change this:
* -------------------------------------------------------------------------- */

/* To this: */
* -------------------------------------------------------------------------- */
```

### Fix 2: Add Missing Import
```typescript
// At top of orders.ts, add:
import { initiateRefund } from "./refund";
```

### Fix 3: Remove Duplicate Field in payments.ts
```typescript
// In toEmailPayload function, remove duplicate:
amount: data?.totalAmount ?? 0, // ✅ REQUIRED FIX - DELETE THIS LINE
```

### Fix 4: Add Idempotency Key to Order Creation
```typescript
// In orders.ts create order route, add:
const idempotencyKey = req.headers["x-idempotency-key"] as string;
// Check if order with this key already exists
```

### Fix 5: Add Rate Limiting to Auth Routes
```typescript
// In users.ts, add rate limiting for login/signup
// Currently uses globalLimiter but should have stricter limits for auth
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT                                            │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        /users/signup                                        │
│                        /users/login                                         │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        /orders (POST)                                       │
│  1. Validate input                                                          │
│  2. Calculate pricing (fetch product prices from Firestore)               │
│  3. Create order document                                                  │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼ (if paymentMethod === "cod")
┌─────────────────────────────────────────────────────────────────────────────┐
│                        /payments/cod                                        │
│  Update paymentStatus to PENDING, orderStatus to PLACED                    │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼ (if online payment)
┌─────────────────────────────────────────────────────────────────────────────┐
│                        /payments/razorpay-order                             │
│  Create Razorpay order, return order ID                                     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Client completes payment on Razorpay                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        /payments/verify                                     │
│  1. Validate Razorpay signature                                             │
│  2. Fetch payment status from Razorpay                                     │
│  3. confirmPayment() → Update order status, create payment record         │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
┌──────────────────────────┐    ┌──────────────────────────────────────────┐
│   deductInventory()      │    │   sendOrderEmail("payment_success")     │
│   - Decrement sizeInventory│    │   - Send confirmation email             │
│   - Update salesCount    │    │                                          │
└──────────────────────────┘    └──────────────────────────────────────────┘

Webhook Alternative:
┌─────────────────────────────────────────────────────────────────────────────┐
│                        /payments/webhook                                    │
│  Razorpay calls this when payment is captured                               │
│  Same flow as /payments/verify after confirmation                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Order Status Flow

```
PENDING (awaiting payment)
    │
    ├──► PLACED (COD/Pay Later or payment initiated)
    │        │
    │        ├──► CONFIRMED (admin confirms)
    │        │        │
    │        │        ├──► PROCESSING (preparing)
    │        │        │        │
    │        │        │        ├──► SHIPPED
    │        │        │        │        │
    │        │        │        │        └──► DELIVERED ✓
    │        │        │        │
    │        │        │        └──► CANCELLED (before shipping)
    │        │        │
    │        │        └──► CANCELLED (before confirmed)
    │        │
    │        └──► CANCELLED (by user)
    │
    └──► PAYMENT_FAILED
             │
             └──► REFUND_INITIATED → REFUNDED
```

---

## Security Considerations

1. **Signature Validation**: Razorpay webhook signatures are validated using HMAC-SHA256
2. **Password Hashing**: bcrypt with 12 salt rounds
3. **JWT**: HS256 algorithm with 1 hour expiration
4. **Rate Limiting**: Global rate limiter applied (should be stricter for auth)
5. **CSRF Protection**: Enabled via middleware

---

## Environment Variables Required

```
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
ENFORCE_RAZORPAY_SIGNATURE (default: true)
JWT_SECRET
MAIL_SMTP_HOST
MAIL_SMTP_PORT
MAIL_SMTP_SECURE
MAIL_SMTP_USER
MAIL_SMTP_PASS
MAIL_FROM_EMAIL
MAIL_FROM_NAME
APP_BASE_URL
MAIL_ADMIN_EMAILS
```

---

## Summary of Issues to Fix

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | orders.ts | Syntax error in comment (`*` vs `/*`) | HIGH |
| 2 | orders.ts | Missing `initiateRefund` import | HIGH |
| 3 | payments.ts | Duplicate `amount` field | LOW |
| 4 | orders.ts | No idempotency key for order creation | MEDIUM |
| 5 | users.ts | No specific rate limiting for auth | MEDIUM |