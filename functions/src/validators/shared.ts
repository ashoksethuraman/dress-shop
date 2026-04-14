import type {ValidationResult} from "../types";
import {isObject, isNonEmptyString, isFiniteNumber, fail} from "./helpers";
import type {AddressDto} from "../types/order";

export function validateAddress(addr: unknown, label: string): ValidationResult {
  if (!isObject(addr)) return fail(`${label} is required.`, label);
  for (const field of ["name", "line1", "city", "state", "pincode", "country", "phone"] as const) {
    if (!isNonEmptyString((addr as Partial<AddressDto>)[field])) {
      return fail(
        `${label}.${field} is required and must be a non-empty string.`,
        `${label}.${field}`
      );
    }
  }
  return {valid: true};
}

export function validateOrderItem(item: unknown, idx: number): ValidationResult {
  if (!isObject(item)) return fail(`items[${idx}] must be an object.`, `items[${idx}]`);
  const pre = `items[${idx}]`;
  if (!isNonEmptyString(item.productId)) return fail(`${pre}.productId is required.`, `${pre}.productId`);
  if (!isNonEmptyString(item.title)) return fail(`${pre}.title is required.`, `${pre}.title`);
  if (
    !isFiniteNumber(item.qty) ||
    (item.qty as number) < 1 ||
    (item.qty as number) > 10 ||
    !Number.isInteger(item.qty)
  ) {
    return fail(`${pre}.qty must be a positive integer between 1 and 10.`, `${pre}.qty`);
  }
  return {valid: true};
}
