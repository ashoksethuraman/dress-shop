
export const ORDER_STATUSES = [
  "PENDING", "PLACED", "CONFIRMED", "PROCESSING", "SHIPPED",
  "DELIVERED", "CANCELLED", "PAYMENT_FAILED",
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const PAYMENT_STATUSES = [
  "PENDING", "SUCCESS", "FAILED", "CANCELLED", "REFUNDED",
] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const REFUND_STATUSES = [
  "NONE", "INITIATED", "PROCESSING", "COMPLETED", "FAILED",
] as const;
export type RefundStatus = typeof REFUND_STATUSES[number];

export type FailReason = "payment_dismissed" | "payment_failed";

export interface AddressPayload {
  name:    string;
  line1:   string;
  line2?:  string | null;
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
  // unitPrice and total omitted — server fetches authoritative prices from Firestore
  size?:     string | null;
  ageSize?:  string | null;
}


export interface CreateOrderPayload {
  id:                     string;
  contactEmail:           string;
  billingAddress:         AddressPayload;
  shippingAddress?:       AddressPayload;
  billingAndShippingSame: boolean;
  items:                  OrderItemPayload[];
  // Client sends totalAmount only for server-side tamper detection.
  // subtotal, taxAmount, shippingFee, discount are computed by the server.
  totalAmount?:           number;
}

export interface CreateOrderResponse {
  id:          string;
  totalAmount: number;  // server-calculated authoritative total
}


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


export interface FailPaymentPayload {
  orderId: string;
  reason?: FailReason;
}


export interface CreateRazorpayOrderPayload {
  // amount intentionally removed — server reads from stored order
  orderId: string;
}

export interface CreateRazorpayOrderResponse {
  razorpayOrderId: string;
  amount:          number;
  currency:        string;
  keyId:           string;  // public key returned from backend — never hardcode in frontend
}


export interface RecordPaymentPayload {
  paymentId:          string;
  orderId:            string;
  // amount intentionally removed — server reads totalAmount from stored order
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


export interface InitiateRefundPayload {
  orderId: string;
  reason?: string;  // optional admin note
}

export interface InitiateRefundResponse {
  success:  boolean;
  refundId: string;
  status:   string;  // Razorpay refund status: created | processed | failed
}


export interface UpdateOrderStatusPayload {
  orderId: string;
  status:  OrderStatus;
}


export interface StoredAddress {
  name:    string;
  line1:   string;
  line2?:  string | null;
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
  ageSize?:  string | null;
}

export interface TimelineEntry {
  status:     string;
  note?:      string;
  timestamp:  string;
}

export interface StoredOrder {
  id:                     string;
  userId?:                string;
  orderStatus:            OrderStatus;
  paymentStatus:          PaymentStatus;
  refundStatus?:          RefundStatus;
  refundId?:              string;
  billingAndShippingSame: boolean;
  contactEmail?:          string;
  billingAddress?:        StoredAddress;
  shippingAddress?:       StoredAddress;
  items:            StoredOrderItem[];
  subtotal:         number;
  taxAmount:        number;
  shippingFee:      number;
  discount:         number;
  totalAmount:      number;
  paymentId?:       string;
  paymentMethod?:   string | null;
  timeline:         TimelineEntry[];
  createdAt:        string | null;
  updatedAt?:       string | null;
}

export interface TrackOrderResponse {
  id:                     string;
  orderStatus:            OrderStatus;
  paymentStatus:          PaymentStatus;
  paymentMethod:          string | null;
  totalAmount:            number;
  createdAt:              string | null;
  shippingAddress:        StoredAddress | null;
  billingAddress?:        StoredAddress;
  billingAndShippingSame: boolean;
  timeline:               TimelineEntry[];
  items:                  StoredOrderItem[];
}


export class ApiError extends Error {
  readonly status: number;
  readonly field?: string;
  readonly body?: Record<string, any>;

  constructor(status: number, message: string, field?: string, body?: Record<string, any>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
    this.body = body;
  }
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error)    return err.message || fallback;
  return fallback;
}

export interface StockValidationIssue {
  productId: string;
  title: string;
  reason: 'not_found' | 'out_of_stock' | 'size_unavailable' | 'insufficient_stock';
  size?: string | null;
  ageSize?: string | null;
  requestedQty?: number;
  availableQty?: number;
}

// ── Auth / User types ─────────────────────────────────────────────────────────

export interface SignupPayload {
  username:     string;
  email:        string;
  password:     string;
  age:          number;
  gender:       'male' | 'female';
  mobileNumber: string;
  address?:     string;
}

export interface AuthUserInfo {
  uid:      string;
  username: string;
  email:    string;
  role:     string;
}

export interface AuthResponse {
  success: true;
  token:   string;
  user:    AuthUserInfo;
}

export interface UserProfile {
  uid:          string;
  username:     string | null;
  name:         string | null;
  email:        string | null;
  age:          number | null;
  gender:       string | null;
  mobileNumber: string | null;
  address:      string | null;
  photoURL:     string | null;
  role:         string;
  isAdmin:      boolean;
  isGuest:      boolean;
}
