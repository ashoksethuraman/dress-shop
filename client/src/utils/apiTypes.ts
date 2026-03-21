/**
 * apiTypes.ts — Frontend mirror of the backend API contracts.
 *
 * Keep this file in sync with:  functions/src/schemas.ts
 *
 * Rules:
 *  - Every interface here must exactly match the corresponding backend interface.
 *  - Never import from the functions/ folder — this mirror is intentional.
 *  - Use these types in apiClient.ts, page components, and the store.
 */

// ── Status enums (must match functions/src/schemas.ts) ────────────────────

export const ORDER_STATUSES = [
  "PENDING", "PLACED", "CONFIRMED", "PROCESSING", "SHIPPED",
  "DELIVERED", "CANCELLED", "PAYMENT_FAILED",
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const PAYMENT_STATUSES = [
  "PENDING", "SUCCESS", "FAILED", "CANCELLED", "REFUNDED",
] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export type FailReason = "payment_dismissed" | "payment_failed";

// ── Sub-schemas ────────────────────────────────────────────────────────────

export interface AddressPayload {
  name:    string;
  line1:   string;
  line2?:  string;
  city:    string;
  state:   string;
  pincode: string;
  country: string;
  phone:   string;
}

export interface OrderItemPayload {
  productId: string;
  title:     string;
  qty:       number;
  unitPrice: number;
  total:     number;
  size?:     string | null;
}

// ── POST /apiCreateOrder ───────────────────────────────────────────────────

export interface CreateOrderPayload {
  id:               string;
  contactEmail:     string;
  billingAddress:   AddressPayload;
  shippingAddress?: AddressPayload;   // omit when same as billing
  items:            OrderItemPayload[];
  subtotal:         number;
  taxAmount:        number;
  shippingFee:      number;
  discount:         number;
  totalAmount:      number;
}

export interface CreateOrderResponse {
  id: string;
}

// ── POST /apiVerifyPayment ─────────────────────────────────────────────────

export interface VerifyPaymentPayload {
  orderId:               string;
  razorpay_payment_id:   string;
  razorpay_signature:    string;
  razorpay_order_id?:    string;
}

export interface VerifyPaymentResponse {
  success:   boolean;
  paymentId: string;
}

// ── POST /apiFailPayment ───────────────────────────────────────────────────

export interface FailPaymentPayload {
  orderId: string;
  reason?: FailReason;
}

// ── POST /apiCreateRazorpayOrder ───────────────────────────────────────────

export interface CreateRazorpayOrderPayload {
  amount:  number;
  orderId: string;
}

export interface CreateRazorpayOrderResponse {
  razorpayOrderId: string;
  amount:          number;
  currency:        string;
}

// ── POST /apiRecordPayment ─────────────────────────────────────────────────

export interface RecordPaymentPayload {
  paymentId:          string;
  orderId:            string;
  amount:             number;
  provider?:          string;
  razorpayOrderId?:   string | null;
  razorpaySignature?: string | null;
  currency?:          string;
  method?:            string | null;
  transactionRef?:    string | null;
  utr?:               string | null;
  cardLast4?:         string | null;
  cardNetwork?:       string | null;
  customerName?:      string | null;
  customerEmail?:     string | null;
  isTest?:            boolean;
}

export interface RecordPaymentResponse {
  success:   boolean;
  paymentId: string;
}

// ── POST /apiUpdateOrderStatus ─────────────────────────────────────────────

export interface UpdateOrderStatusPayload {
  orderId: string;
  status:  OrderStatus;
}

// ── Stored document shapes (returned from GET endpoints) ──────────────────

export interface StoredAddress {
  name:    string;
  line1:   string;
  line2?:  string;
  city:    string;
  state:   string;
  pincode: string;
  country: string;
  phone:   string;
}

export interface StoredOrderItem {
  productId: string;
  title:     string;
  qty:       number;
  unitPrice: number;
  total:     number;
  size?:     string | null;
}

export interface TimelineEntry {
  status:     string;
  note?:      string;
  timestamp:  string;
}

export interface StoredOrder {
  id:               string;
  orderStatus:      OrderStatus;
  paymentStatus:    PaymentStatus;
  contactEmail?:    string;
  shippingAddress?: StoredAddress;
  billingAddress?:  StoredAddress;
  items:            StoredOrderItem[];
  subtotal:         number;
  taxAmount:        number;
  shippingFee:      number;
  discount:         number;
  totalAmount:      number;
  paymentId?:       string;
  timeline:         TimelineEntry[];
  createdAt:        string | null;
  updatedAt?:       string | null;
}

export interface TrackOrderResponse {
  id:               string;
  orderStatus:      OrderStatus;
  paymentStatus:    PaymentStatus;
  paymentMethod:    string | null;
  totalAmount:      number;
  createdAt:        string | null;
  shippingAddress:  StoredAddress | null;
  items:            StoredOrderItem[];
}

// ── Structured API error ───────────────────────────────────────────────────

/**
 * Thrown by the apiClient `request()` helper whenever the server responds
 * with a non-2xx status.  Always carries a human-readable `message` taken
 * from the server's `{ error }` JSON field plus the HTTP `status` code.
 * Optionally carries a `field` name for inline form validation errors.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly field?: string;

  constructor(status: number, message: string, field?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
  }
}

/** Safely extracts a display-friendly message from any thrown value. */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error)    return err.message || fallback;
  return fallback;
}
