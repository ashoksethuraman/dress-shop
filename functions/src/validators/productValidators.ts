import type {ValidationResult} from "../types";
import {PRODUCT_CATEGORIES, STOCK_STATUSES} from "../types";
import type {UpdateProductBody} from "../types/product";
import {
  isObject, isNonEmptyString, requireStr, requireNonNegNum, requireOneOf, optionalStringArray, fail,
} from "./helpers";

function validateProductFields(
  b: Record<string, unknown>, requireTitle: boolean
): ValidationResult {
  if (requireTitle) {
    const e = requireStr(b, "title");
    if (e) return e;

    // productCode is required when creating a new product
    const pcErr = requireStr(b, "productCode");
    if (pcErr) return pcErr;
    if (typeof b.productCode === "string" && b.productCode.trim().length < 2) {
      return fail("productCode must be at least 2 characters.", "productCode");
    }
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

  // Determine if this is a children's category
  const category = b.category as string | undefined;
  const isChildCategory = category === "boys" || category === "girls";
  const isAdultCategory = category === "men" || category === "women";

  // Validate sizes based on category
  const sizesErr = optionalStringArray(b, "sizes");
  if (sizesErr) return sizesErr;

  const ageSizesErr = optionalStringArray(b, "ageSizes");
  if (ageSizesErr) return ageSizesErr;

  // Category-specific size validation
  if (isChildCategory) {
    // Boys/Girls should use ageSizes, not sizes
    if (b.sizes !== undefined && Array.isArray(b.sizes) && (b.sizes as unknown[]).length > 0) {
      return fail("Boys/Girls products should use ageSizes, not sizes.", "sizes");
    }
    if (b.sizeInventory !== undefined && isObject(b.sizeInventory) && Object.keys(b.sizeInventory as object).length > 0) {
      return fail("Boys/Girls products should use ageSizeInventory, not sizeInventory.", "sizeInventory");
    }
  } else if (isAdultCategory) {
    // Men/Women should use sizes, not ageSizes
    if (b.ageSizes !== undefined && Array.isArray(b.ageSizes) && (b.ageSizes as unknown[]).length > 0) {
      return fail("Men/Women products should use sizes, not ageSizes.", "ageSizes");
    }
    if (b.ageSizeInventory !== undefined && isObject(b.ageSizeInventory) && Object.keys(b.ageSizeInventory as object).length > 0) {
      return fail("Men/Women products should use sizeInventory, not ageSizeInventory.", "ageSizeInventory");
    }
  }

  // Validate ageSizeInventory if present
  if (b.ageSizeInventory !== undefined) {
    if (!isObject(b.ageSizeInventory) || Array.isArray(b.ageSizeInventory)) {
      return fail("ageSizeInventory must be an object mapping age size to quantity.", "ageSizeInventory");
    }
    for (const [k, v] of Object.entries(b.ageSizeInventory as Record<string, unknown>)) {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
        return fail(`ageSizeInventory["${k}"] must be a non-negative integer.`, "ageSizeInventory");
      }
    }
  }

  if (b.sizeChart !== undefined && b.sizeChart !== null && b.sizeChart !== "") {
    if (typeof b.sizeChart !== "string") return fail("sizeChart must be a string URL.", "sizeChart");
    if (!(b.sizeChart as string).startsWith("size-charts")) {
      return fail("sizeChart must be a valid URL.", "sizeChart");
    }
  }

  if (b.shippingAndDelivery !== undefined) {
    if (typeof b.shippingAndDelivery !== "string") return fail("shippingAndDelivery must be a string.", "shippingAndDelivery");
    if ((b.shippingAndDelivery as string).trim().length === 0) return fail("shippingAndDelivery cannot be empty.", "shippingAndDelivery");
  }

  if (b.exchangeAndReturns !== undefined) {
    if (typeof b.exchangeAndReturns !== "string") return fail("exchangeAndReturns must be a string.", "exchangeAndReturns");
    if ((b.exchangeAndReturns as string).trim().length === 0) return fail("exchangeAndReturns cannot be empty.", "exchangeAndReturns");
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
    "images", "sizes", "stock", "sizeInventory", "sizeChart", "shippingAndDelivery", "exchangeAndReturns",
    "ageSizes", "ageSizeInventory",
  ];
  if (!allowed.some((k) => body[k] !== undefined)) {
    return fail("At least one field to update is required.");
  }
  return validateProductFields(body, false);
}

// Re-export for convenience
// export {isNonNegativeNumber};
