import type {ValidationResult} from "../types";
import {PRODUCT_CATEGORIES, STOCK_STATUSES} from "../types";
import type {UpdateProductBody} from "../types/product";
import {
  isObject, isNonEmptyString, isNonNegativeNumber,
  requireStr, requireNonNegNum, requireOneOf, optionalStringArray, fail,
} from "./helpers";

function validateProductFields(
  b: Record<string, unknown>, requireTitle: boolean
): ValidationResult {
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

  if (b.sizeChart !== undefined && b.sizeChart !== null && b.sizeChart !== "") {
    if (typeof b.sizeChart !== "string") return fail("sizeChart must be a string URL.", "sizeChart");
    if (
      !(b.sizeChart as string).startsWith("https://") &&
      !(b.sizeChart as string).startsWith("/")
    ) {
      return fail("sizeChart must be a valid URL.", "sizeChart");
    }
  }

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

export function validateCreateProduct(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  return validateProductFields(body, true);
}

export function validateUpdateProduct(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");
  const allowed: Array<keyof UpdateProductBody> = [
    "title", "description", "price", "category",
    "images", "sizes", "stock", "sizeInventory", "sizeChart",
  ];
  if (!allowed.some((k) => body[k] !== undefined)) {
    return fail("At least one field to update is required.");
  }
  return validateProductFields(body, false);
}

// Re-export for convenience
export {isNonNegativeNumber};
