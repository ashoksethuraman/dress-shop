# API Flow Analysis - Client vs Backend

## Issues Found

### 1. ❌ REFUND ENDPOINT MISSING
- **Client calls**: `POST /payments/refund`
- **Backend has**: No such route exists!
- **Impact**: Refunds cannot be initiated from client

### 2. ❌ CANCEL ENDPOINT HAS WRONG AUTH
- **Client calls**: `POST /orders/:id/cancel` (likely for users)
- **Backend has**: `ordersRouter.post("/:id/cancel", requireAdmin, ...)`
- **Impact**: Only admins can cancel orders - users get 403

### 3. ❌ NO REFUND HTTP ROUTE
- **Backend has**: `initiateRefund()` function in refund.ts
- **But**: Not exposed as HTTP endpoint
- **Impact**: Refund logic exists but can't be triggered

---

## Current Backend Routes

### Orders (`/orders`)
| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/` | optionalAuth | ✅ |
| GET | `/track/:id` | none | ✅ |
| GET | `/id/:id` | authenticate | ✅ |
| GET | `/me` | authenticate | ✅ |
| POST | `/:id/status` | requireAdmin | ✅ |
| POST | `/:id/cancel` | **requireAdmin** | ❌ Should be optionalAuth |

### Payments (`/payments`)
| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/razorpay-order` | validate | ✅ |
| POST | `/verify` | optionalAuth | ✅ |
| POST | `/fail` | optionalAuth | ✅ |
| POST | `/cod` | none | ✅ |
| POST | `/webhook` | none (raw body) | ✅ |
| POST | `/refund` | **MISSING** | ❌ Need to add |

---

## Required Fixes

### Fix 1: Add Refund Route to Payments
Add `/refund` endpoint in payments.ts

### Fix 2: Fix Cancel Auth
Change cancel route to allow users to cancel their own orders

### Fix 3: Add User Cancel Endpoint
Add endpoint for users to cancel their own orders