/**
 * schemas.ts — Canonical data contracts for all Cloud Function endpoints.
 *
 * Every request body shape is defined here as a TypeScript interface plus a
 * corresponding `validate*` function that does runtime type-checking and
 * returns a structured result.  Cloud Functions import from here so the
 * validation logic is defined in exactly one place.
 *
 * The matching frontend mirror lives in:  client/src/utils/apiTypes.ts
 * Keep both files in sync whenever you add or rename a field.
 */

// ── Status enums ───────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  "PENDING", "PLACED", "CONFIRMED", "PROCESSING", "SHIPPED",
  "DELIVERED", "CANCELLED", "PAYMENT_FAILED",
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const PAYMENT_STATUSES = [
  "PENDING", "SUCCESS", "FAILED", "CANCELLED", "REFUNDED",
] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const FAIL_REASONS = ["payment_dismissed", "payment_failed"] as const;
export type FailReason = typeof FAIL_REASONS[number];

// ── Sub-schemas ────────────────────────────────────────────────────────────

export interface AddressSchema {
  name:     string;
  line1:    string;
  line2?:   string;
  city:     string;
  state:    string;
  pincode:  string;
  country:  string;
  phone:    string;
}

export interface OrderItemSchema {
  productId: string;
  title:     string;
  qty:       number;
  unitPrice: number;
  total:     number;
  size?:     string | null;
}

// ── Request body interfaces ────────────────────────────────────────────────

export interface CreateOrderBody {
  id?:                    string;
  contactEmail:           string;
  billingAddress:         AddressSchema;
  shippingAddress?:       AddressSchema;  // only present when billingAndShippingSame=false
  billingAndShippingSame: boolean;
  items:                  OrderItemSchema[];
  subtotal:               number;
  taxAmount:              number;
  shippingFee:            number;
  discount:               number;
  totalAmount:            number;
}

export interface VerifyPaymentBody {
  orderId:               string;
  razorpay_payment_id:   string;
  razorpay_signature:    string;
  razorpay_order_id?:    string;
}

export interface FailPaymentBody {
  orderId: string;
  reason?: FailReason;
}

export interface CreateRazorpayOrderBody {
  amount:   number;
  orderId:  string;
}

export interface RecordPaymentBody {
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

export interface UpdateOrderStatusBody {
  orderId: string;
  status:  OrderStatus;
}

// ── Product body interfaces ────────────────────────────────────────────────

export const PRODUCT_CATEGORIES = ["men", "women"] as const;
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const STOCK_STATUSES = ["available", "out_of_stock"] as const;
export type StockStatus = typeof STOCK_STATUSES[number];

export interface CreateProductBody {
  title:        string;
  description?: string;
  price:        number;
  category?:    ProductCategory;
  images?:      string[];
  sizes?:       string[];
  stock?:       StockStatus;
}

export interface UpdateProductBody {
  title?:        string;
  description?:  string;
  price?:        number;
  category?:     ProductCategory;
  images?:       string[];
  sizes?:        string[];
  stock?:        StockStatus;
}

export interface UpdateProfileBody {
  displayName?: string;
  phone?:       string;
  photoURL?:    string;
}

export interface SetAdminClaimBody {
  targetUid: string;
  isAdmin:   boolean;
}

// ── Response shape interfaces ──────────────────────────────────────────────

export interface ApiErrorResponse {
  error: string;
  field?: string;
}

export interface CreateOrderResponse {
  id: string;
}

export interface VerifyPaymentResponse {
  success:   boolean;
  paymentId: string;
}

export interface RecordPaymentResponse {
  success:   boolean;
  paymentId: string;
}

// ── Validation primitives ──────────────────────────────────────────────────

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string; field?: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNonNegativeNumber(v: unknown): v is number {
  return isFiniteNumber(v) && (v as number) >= 0;
}

function isPositiveNumber(v: unknown): v is number {
  return isFiniteNumber(v) && (v as number) > 0;
}

function isEmail(v: unknown): v is string {
  return isNonEmptyString(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function validateAddress(addr: unknown, label: string): ValidationResult {
  if (!addr || typeof addr !== "object") {
    return { valid: false, error: `${label} is required.`, field: label };
  }
  const a = addr as Record<string, unknown>;
  const required = ["name", "line1", "city", "state", "pincode", "country", "phone"] as const;
  for (const field of required) {
    if (!isNonEmptyString(a[field])) {
      return {
        valid: false,
        error: `${label}.${field} is required and must be a non-empty string.`,
        field: `${label}.${field}`,
      };
    }
  }
  return { valid: true };
}

function validateOrderItem(item: unknown, idx: number): ValidationResult {
  if (!item || typeof item !== "object") {
    return { valid: false, error: `items[${idx}] must be an object.`, field: `items[${idx}]` };
  }
  const it = item as Record<string, unknown>;

  if (!isNonEmptyString(it.productId))
    return { valid: false, error: `items[${idx}].productId is required.`, field: `items[${idx}].productId` };
  if (!isNonEmptyString(it.title))
    return { valid: false, error: `items[${idx}].title is required.`, field: `items[${idx}].title` };
  if (!isFiniteNumber(it.qty) || (it.qty as number) < 1 || !Number.isInteger(it.qty))
    return { valid: false, error: `items[${idx}].qty must be a positive integer.`, field: `items[${idx}].qty` };
  if (!isNonNegativeNumber(it.unitPrice))
    return { valid: false, error: `items[${idx}].unitPrice must be a non-negative number.`, field: `items[${idx}].unitPrice` };
  if (!isNonNegativeNumber(it.total))
    return { valid: false, error: `items[${idx}].total must be a non-negative number.`, field: `items[${idx}].total` };

  return { valid: true };
}

// ── Public validators ──────────────────────────────────────────────────────

export function validateCreateOrder(body: unknown): ValidationResult {
  if (!body || typeof body !== "object")
    return { valid: false, error: "Request body is required." };

  const b = body as Record<string, unknown>;

  if (!isEmail(b.contactEmail))
    return { valid: false, error: "A valid contactEmail is required.", field: "contactEmail" };

  if (typeof b.billingAndShippingSame !== "boolean")
    return { valid: false, error: "billingAndShippingSame must be a boolean.", field: "billingAndShippingSame" };

  const billCheck = validateAddress(b.billingAddress, "billingAddress");
  if (!billCheck.valid) return billCheck;

  // When addresses differ, shippingAddress is required and must be valid
  if (!b.billingAndShippingSame) {
    const shipCheck = validateAddress(b.shippingAddress, "shippingAddress");
    if (!shipCheck.valid) return shipCheck;
  } else if (b.shippingAddress !== undefined) {
    const shipCheck = validateAddress(b.shippingAddress, "shippingAddress");
    if (!shipCheck.valid) return shipCheck;
  }

  if (!Array.isArray(b.items) || b.items.length === 0)
    return { valid: false, error: "items must be a non-empty array.", field: "items" };

  for (let i = 0; i < b.items.length; i++) {
    const itemCheck = validateOrderItem(b.items[i], i);
    if (!itemCheck.valid) return itemCheck;
  }

  const numericFields = ["subtotal", "taxAmount", "shippingFee", "discount", "totalAmount"] as const;
  for (const field of numericFields) {
    if (!isNonNegativeNumber(b[field]))
      return { valid: false, error: `${field} must be a non-negative number.`, field };
  }

  if (!isPositiveNumber(b.totalAmount))
    return { valid: false, error: "totalAmount must be greater than zero.", field: "totalAmount" };

  return { valid: true };
}

export function validateVerifyPayment(body: unknown): ValidationResult {
  if (!body || typeof body !== "object")
    return { valid: false, error: "Request body is required." };

  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.orderId))
    return { valid: false, error: "orderId is required.", field: "orderId" };
  if (!isNonEmptyString(b.razorpay_payment_id))
    return { valid: false, error: "razorpay_payment_id is required.", field: "razorpay_payment_id" };
  if (!isNonEmptyString(b.razorpay_signature))
    return { valid: false, error: "razorpay_signature is required.", field: "razorpay_signature" };

  return { valid: true };
}

export function validateFailPayment(body: unknown): ValidationResult {
  if (!body || typeof body !== "object")
    return { valid: false, error: "Request body is required." };

  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.orderId))
    return { valid: false, error: "orderId is required.", field: "orderId" };
  if (b.reason !== undefined && !(FAIL_REASONS as readonly string[]).includes(b.reason as string))
    return {
      valid: false,
      error: `reason must be one of: ${FAIL_REASONS.join(", ")}.`,
      field: "reason",
    };

  return { valid: true };
}

export function validateCreateRazorpayOrder(body: unknown): ValidationResult {
  if (!body || typeof body !== "object")
    return { valid: false, error: "Request body is required." };

  const b = body as Record<string, unknown>;
  if (!isPositiveNumber(b.amount))
    return { valid: false, error: "amount must be a positive number.", field: "amount" };
  if (!isNonEmptyString(b.orderId))
    return { valid: false, error: "orderId is required.", field: "orderId" };

  return { valid: true };
}

export function validateRecordPayment(body: unknown): ValidationResult {
  if (!body || typeof body !== "object")
    return { valid: false, error: "Request body is required." };

  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.paymentId))
    return { valid: false, error: "paymentId is required.", field: "paymentId" };
  if (!isNonEmptyString(b.orderId))
    return { valid: false, error: "orderId is required.", field: "orderId" };
  if (!isPositiveNumber(b.amount))
    return { valid: false, error: "amount must be a positive number.", field: "amount" };

  return { valid: true };
}

export function validateUpdateOrderStatus(body: unknown): ValidationResult {
  if (!body || typeof body !== "object")
    return { valid: false, error: "Request body is required." };

  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.orderId))
    return { valid: false, error: "orderId is required.", field: "orderId" };
  if (!isNonEmptyString(b.status) || !(ORDER_STATUSES as readonly string[]).includes(b.status as string))
    return {
      valid: false,
      error: `status must be one of: ${ORDER_STATUSES.join(", ")}.`,
      field: "status",
    };

  return { valid: true };
}

export function validateUpdateProfile(body: unknown): ValidationResult {
  if (!body || typeof body !== "object")
    return { valid: false, error: "Request body is required." };

  const b = body as Record<string, unknown>;

  if (
    b.displayName !== undefined &&
    (typeof b.displayName !== "string" || (b.displayName as string).trim().length === 0)
  )
    return { valid: false, error: "displayName must be a non-empty string.", field: "displayName" };

  if (b.phone !== undefined) {
    if (typeof b.phone !== "string" || !/^\+[1-9]\d{6,14}$/.test(b.phone as string))
      return {
        valid: false,
        error: "phone must be in E.164 format (e.g. +919876543210).",
        field: "phone",
      };
  }

  if (
    b.photoURL !== undefined &&
    (typeof b.photoURL !== "string" || (b.photoURL as string).trim().length === 0)
  )
    return { valid: false, error: "photoURL must be a non-empty string.", field: "photoURL" };

  if (
    b.displayName === undefined &&
    b.phone === undefined &&
    b.photoURL === undefined
  )
    return { valid: false, error: "At least one of displayName, phone, or photoURL is required." };

  return { valid: true };
}

export function validateSetAdminClaim(body: unknown): ValidationResult {
  if (!body || typeof body !== "object")
    return { valid: false, error: "Request body is required." };

  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.targetUid))
    return { valid: false, error: "targetUid is required.", field: "targetUid" };
  if (typeof b.isAdmin !== "boolean")
    return { valid: false, error: "isAdmin must be a boolean.", field: "isAdmin" };

  return { valid: true };
}

// ── Product validators ─────────────────────────────────────────────────────

function validateProductFields(b: Record<string, unknown>, requireTitle: boolean): ValidationResult {
  if (requireTitle && !isNonEmptyString(b.title))
    return { valid: false, error: "title is required and must be a non-empty string.", field: "title" };

  if (b.title !== undefined && !isNonEmptyString(b.title))
    return { valid: false, error: "title must be a non-empty string.", field: "title" };

  if (b.description !== undefined && typeof b.description !== "string")
    return { valid: false, error: "description must be a string.", field: "description" };

  if (requireTitle && b.price === undefined)
    return { valid: false, error: "price is required.", field: "price" };

  if (b.price !== undefined) {
    if (typeof b.price !== "number" || !Number.isFinite(b.price) || b.price < 0)
      return { valid: false, error: "price must be a non-negative finite number.", field: "price" };
  }

  if (b.category !== undefined && !(PRODUCT_CATEGORIES as readonly string[]).includes(b.category as string))
    return {
      valid: false,
      error: `category must be one of: ${PRODUCT_CATEGORIES.join(", ")}.`,
      field: "category",
    };

  if (b.stock !== undefined && !(STOCK_STATUSES as readonly string[]).includes(b.stock as string))
    return {
      valid: false,
      error: `stock must be one of: ${STOCK_STATUSES.join(", ")}.`,
      field: "stock",
    };

  if (b.images !== undefined) {
    if (!Array.isArray(b.images) || (b.images as unknown[]).some((i) => typeof i !== "string"))
      return { valid: false, error: "images must be an array of strings.", field: "images" };
  }

  if (b.sizes !== undefined) {
    if (!Array.isArray(b.sizes) || (b.sizes as unknown[]).some((s) => typeof s !== "string"))
      return { valid: false, error: "sizes must be an array of strings.", field: "sizes" };
  }

  return { valid: true };
}

export function validateCreateProduct(body: unknown): ValidationResult {
  if (!body || typeof body !== "object")
    return { valid: false, error: "Request body is required." };

  return validateProductFields(body as Record<string, unknown>, true);
}

export function validateUpdateProduct(body: unknown): ValidationResult {
  if (!body || typeof body !== "object")
    return { valid: false, error: "Request body is required." };

  const b = body as Record<string, unknown>;
  const allowed: Array<keyof UpdateProductBody> = [
    "title", "description", "price", "category", "images", "sizes", "stock",
  ];
  const hasUpdateField = allowed.some((k) => b[k] !== undefined);
  if (!hasUpdateField)
    return { valid: false, error: "At least one field to update is required." };

  return validateProductFields(b, false);
}
