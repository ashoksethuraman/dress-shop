import type {ValidationResult} from "../types";
import {ORDER_STATUSES, FAIL_REASONS} from "../types";
import {isObject, isEmail, isNonNegativeNumber, requireStr, requireOneOf, fail} from "./helpers";
import {validateAddress, validateOrderItem} from "./shared";

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
  if ((body.items as unknown[]).length > 50) {
    return fail("Order may not contain more than 50 distinct items.", "items");
  }
  for (let i = 0; i < body.items.length; i++) {
    const e = validateOrderItem(body.items[i], i);
    if (!e.valid) return e;
  }

  if (body.totalAmount !== undefined && !isNonNegativeNumber(body.totalAmount)) {
    return fail("totalAmount must be a non-negative number.", "totalAmount");
  }

  return {valid: true};
}

export function validateUpdateOrderStatus(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  return requireOneOf(body, "status", ORDER_STATUSES) ?? {valid: true};
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
  if (
    body.reason !== undefined &&
    !(FAIL_REASONS as readonly string[]).includes(body.reason as string)
  ) {
    return fail(`reason must be one of: ${FAIL_REASONS.join(", ")}.`, "reason");
  }
  return {valid: true};
}

export function validateCreateRazorpayOrder(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  return requireStr(body, "orderId") ?? {valid: true};
}

export function validateRecordPayment(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  return (
    requireStr(body, "paymentId") ??
    requireStr(body, "orderId") ??
    {valid: true}
  );
}
