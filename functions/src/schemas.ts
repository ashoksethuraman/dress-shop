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

export const PRODUCT_CATEGORIES = ["men", "women"] as const;
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const STOCK_STATUSES = ["available", "out_of_stock"] as const;
export type StockStatus = typeof STOCK_STATUSES[number];

export interface AddressSchema {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
}

export interface OrderItemSchema {
  productId: string;
  title: string;
  qty: number;
  unitPrice: number;
  total: number;
  size?: string | null;
}

export interface CreateOrderBody {
  id?: string;
  contactEmail: string;
  billingAddress: AddressSchema;
  shippingAddress?: AddressSchema;
  billingAndShippingSame: boolean;
  items: OrderItemSchema[];
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  discount: number;
  totalAmount: number;
}

export interface VerifyPaymentBody {
  orderId: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_order_id?: string;
}

export interface FailPaymentBody {
  orderId: string;
  reason?: FailReason;
}

export interface CreateRazorpayOrderBody {
  amount: number;
  orderId: string;
}

export interface RecordPaymentBody {
  paymentId: string;
  orderId: string;
  amount: number;
  provider?: string;
  razorpayOrderId?: string | null;
  razorpaySignature?: string | null;
  currency?: string;
  method?: string | null;
  transactionRef?: string | null;
  utr?: string | null;
  cardLast4?: string | null;
  cardNetwork?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  isTest?: boolean;
}

export interface UpdateOrderStatusBody {
  orderId: string;
  status: OrderStatus;
}

export interface CreateProductBody {
  title: string;
  description?: string;
  price: number;
  category?: ProductCategory;
  images?: string[];
  sizes?: string[];
  stock?: StockStatus;
  sizeInventory?: Record<string, number>;
}

export interface UpdateProductBody {
  title?: string;
  description?: string;
  price?: number;
  category?: ProductCategory;
  images?: string[];
  sizes?: string[];
  stock?: StockStatus;
  sizeInventory?: Record<string, number>;
}

export interface UpdateProfileBody {
  displayName?: string;
  phone?: string;
  photoURL?: string;
}

export interface SetAdminClaimBody {
  targetUid: string;
  isAdmin: boolean;
}

export interface ApiErrorResponse {
  error: string;
  field?: string;
}

export interface CreateOrderResponse {
  id: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  paymentId: string;
}

export interface RecordPaymentResponse {
  success: boolean;
  paymentId: string;
}

export interface SignupBody {
  username: string;
  email: string;
  password: string;
  age: number;
  gender: "male" | "female";
  mobileNumber: string;
  address?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface AuthUserResponse {
  uid: string;
  username: string;
  email: string;
  role: "user";
}

export interface AuthSignupResponse {
  success: true;
  token: string;
  user: AuthUserResponse;
}

export interface AuthLoginResponse {
  success: true;
  token: string;
  user: AuthUserResponse;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string; field?: string };

// ── Primitive guards ──────────────────────────────────────────────────────────

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

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

// ── Validation builder helpers ────────────────────────────────────────────────
// Each returns a ValidationResult on failure, or null on success, so callers
// can chain them with: `return helperA(...) ?? helperB(...) ?? {valid: true}`.

function fail(error: string, field?: string): ValidationResult {
  return {valid: false, error, field};
}

function requireStr(b: Record<string, unknown>, field: string, label?: string): ValidationResult | null {
  return isNonEmptyString(b[field]) ? null : fail(`${label ?? field} is required.`, field);
}

function requirePosNum(b: Record<string, unknown>, field: string): ValidationResult | null {
  return isPositiveNumber(b[field]) ? null : fail(`${field} must be a positive number.`, field);
}

function requireNonNegNum(b: Record<string, unknown>, field: string): ValidationResult | null {
  return isNonNegativeNumber(b[field]) ? null : fail(`${field} must be a non-negative number.`, field);
}

function requireOneOf(
  b: Record<string, unknown>,
  field: string,
  values: readonly string[]
): ValidationResult | null {
  if (!isNonEmptyString(b[field]) || !(values as string[]).includes(b[field] as string)) {
    return fail(`${field} must be one of: ${values.join(", ")}.`, field);
  }
  return null;
}

function optionalStringArray(b: Record<string, unknown>, field: string): ValidationResult | null {
  if (b[field] === undefined) return null;
  if (!Array.isArray(b[field]) || (b[field] as unknown[]).some((v) => typeof v !== "string")) {
    return fail(`${field} must be an array of strings.`, field);
  }
  return null;
}

// ── Compound sub-validators ───────────────────────────────────────────────────

function validateAddress(addr: unknown, label: string): ValidationResult {
  if (!isObject(addr)) return fail(`${label} is required.`, label);
  for (const field of ["name", "line1", "city", "state", "pincode", "country", "phone"] as const) {
    if (!isNonEmptyString(addr[field])) {
      return fail(`${label}.${field} is required and must be a non-empty string.`, `${label}.${field}`);
    }
  }
  return {valid: true};
}

function validateOrderItem(item: unknown, idx: number): ValidationResult {
  if (!isObject(item)) return fail(`items[${idx}] must be an object.`, `items[${idx}]`);
  const pre = `items[${idx}]`;
  if (!isNonEmptyString(item.productId)) return fail(`${pre}.productId is required.`, `${pre}.productId`);
  if (!isNonEmptyString(item.title)) return fail(`${pre}.title is required.`, `${pre}.title`);
  if (!isFiniteNumber(item.qty) || (item.qty as number) < 1 || !Number.isInteger(item.qty)) {
    return fail(`${pre}.qty must be a positive integer.`, `${pre}.qty`);
  }
  if (!isNonNegativeNumber(item.unitPrice)) return fail(`${pre}.unitPrice must be a non-negative number.`, `${pre}.unitPrice`);
  if (!isNonNegativeNumber(item.total)) return fail(`${pre}.total must be a non-negative number.`, `${pre}.total`);
  return {valid: true};
}

function validateProductFields(b: Record<string, unknown>, requireTitle: boolean): ValidationResult {
  if (requireTitle) {
    const e = requireStr(b, "title");
    if (e) return e;
  } else if (b.title !== undefined && !isNonEmptyString(b.title)) {
    return fail("title must be a non-empty string.", "title");
  }

  if (b.description !== undefined && typeof b.description !== "string") {
    return fail("description must be a string.", "description");
  }

  if (requireTitle && b.price === undefined) return fail("price is required.", "price");
  if (b.price !== undefined) {
    const e = requireNonNegNum(b, "price");
    if (e) return e;
  }

  if (b.category !== undefined) {
    const e = requireOneOf(b, "category", PRODUCT_CATEGORIES);
    if (e) return e;
  }

  if (b.stock !== undefined) {
    const e = requireOneOf(b, "stock", STOCK_STATUSES);
    if (e) return e;
  }

  const imagesErr = optionalStringArray(b, "images");
  if (imagesErr) return imagesErr;

  const sizesErr = optionalStringArray(b, "sizes");
  if (sizesErr) return sizesErr;

  if (b.sizeInventory !== undefined) {
    if (!isObject(b.sizeInventory) || Array.isArray(b.sizeInventory)) {
      return fail("sizeInventory must be an object mapping size to quantity.", "sizeInventory");
    }
    for (const [k, v] of Object.entries(b.sizeInventory as Record<string, unknown>)) {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
        return fail(`sizeInventory["${k}"] must be a non-negative integer.`, "sizeInventory");
      }
    }
  }

  return {valid: true};
}

// ── Public validators ─────────────────────────────────────────────────────────

export function validateCreateOrder(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  if (!isEmail(body.contactEmail)) return fail("A valid contactEmail is required.", "contactEmail");
  if (typeof body.billingAndShippingSame !== "boolean") {
    return fail("billingAndShippingSame must be a boolean.", "billingAndShippingSame");
  }

  const billCheck = validateAddress(body.billingAddress, "billingAddress");
  if (!billCheck.valid) return billCheck;

  if (!body.billingAndShippingSame || body.shippingAddress !== undefined) {
    const shipCheck = validateAddress(body.shippingAddress, "shippingAddress");
    if (!shipCheck.valid) return shipCheck;
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return fail("items must be a non-empty array.", "items");
  }
  for (let i = 0; i < body.items.length; i++) {
    const e = validateOrderItem(body.items[i], i);
    if (!e.valid) return e;
  }

  for (const field of ["subtotal", "taxAmount", "shippingFee", "discount", "totalAmount"] as const) {
    const e = requireNonNegNum(body, field);
    if (e) return e;
  }
  if (!isPositiveNumber(body.totalAmount)) return fail("totalAmount must be greater than zero.", "totalAmount");

  return {valid: true};
}

export function validateVerifyPayment(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  return (
    requireStr(body, "orderId") ??
    requireStr(body, "razorpay_payment_id") ??
    requireStr(body, "razorpay_signature") ??
    {valid: true}
  );
}

export function validateFailPayment(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  const e = requireStr(body, "orderId");
  if (e) return e;
  if (body.reason !== undefined && !(FAIL_REASONS as readonly string[]).includes(body.reason as string)) {
    return fail(`reason must be one of: ${FAIL_REASONS.join(", ")}.`, "reason");
  }
  return {valid: true};
}

export function validateCreateRazorpayOrder(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  return requirePosNum(body, "amount") ?? requireStr(body, "orderId") ?? {valid: true};
}

export function validateRecordPayment(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  return (
    requireStr(body, "paymentId") ??
    requireStr(body, "orderId") ??
    requirePosNum(body, "amount") ??
    {valid: true}
  );
}

export function validateUpdateOrderStatus(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  return requireStr(body, "orderId") ?? requireOneOf(body, "status", ORDER_STATUSES) ?? {valid: true};
}

export function validateUpdateProfile(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  if (body.displayName !== undefined && !isNonEmptyString(body.displayName)) {
    return fail("displayName must be a non-empty string.", "displayName");
  }
  if (body.phone !== undefined && (typeof body.phone !== "string" || !/^\+[1-9]\d{6,14}$/.test(body.phone as string))) {
    return fail("phone must be in E.164 format (e.g. +919876543210).", "phone");
  }
  if (body.photoURL !== undefined && !isNonEmptyString(body.photoURL)) {
    return fail("photoURL must be a non-empty string.", "photoURL");
  }
  if (body.displayName === undefined && body.phone === undefined && body.photoURL === undefined) {
    return fail("At least one of displayName, phone, or photoURL is required.");
  }
  return {valid: true};
}

export function validateSetAdminClaim(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  const e = requireStr(body, "targetUid");
  if (e) return e;
  if (typeof body.isAdmin !== "boolean") return fail("isAdmin must be a boolean.", "isAdmin");
  return {valid: true};
}

export function validateCreateProduct(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  return validateProductFields(body, true);
}

export function validateUpdateProduct(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  const allowed: Array<keyof UpdateProductBody> = [
    "title", "description", "price", "category", "images", "sizes", "stock", "sizeInventory",
  ];
  if (!allowed.some((k) => body[k] !== undefined)) {
    return fail("At least one field to update is required.");
  }
  return validateProductFields(body, false);
}

// Strong password: min 8 chars, ≥1 upper, ≥1 lower, ≥1 digit, ≥1 special char
const STRONG_PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,}$/;

const PHONE_RE = /^\+?[0-9]{10,15}$/;

export function validateSignup(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Invalid request body.");
  const usernameErr = requireStr(body, "username", "Username");
  if (usernameErr) return usernameErr;
  const ulen = (body.username as string).trim().length;
  if (ulen < 2 || ulen > 50) return fail("Username must be 2–50 characters.", "username");
  if (!isEmail(body.email)) return fail("A valid email address is required.", "email");
  const pwErr = requireStr(body, "password", "Password");
  if (pwErr) return pwErr;
  if (!STRONG_PASSWORD_RE.test(body.password as string)) {
    return fail(
      "Password must be ≥8 characters with uppercase, lowercase, digit, and special character.",
      "password"
    );
  }
  if (typeof body.age !== "number" || !Number.isInteger(body.age) || body.age < 13 || body.age > 120) {
    return fail("Age must be an integer between 13 and 120.", "age");
  }
  if (body.gender !== "male" && body.gender !== "female") {
    return fail("Gender must be 'male' or 'female'.", "gender");
  }
  if (!isNonEmptyString(body.mobileNumber) || !PHONE_RE.test((body.mobileNumber as string).trim())) {
    return fail("A valid mobile number (10–15 digits) is required.", "mobileNumber");
  }
  if (body.address !== undefined && body.address !== null && typeof body.address !== "string") {
    return fail("Address must be a string.", "address");
  }
  return {valid: true};
}

export function validateLogin(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Invalid request body.");
  if (!isEmail(body.email)) return fail("A valid email address is required.", "email");
  return requireStr(body, "password", "Password") ?? {valid: true};
}
