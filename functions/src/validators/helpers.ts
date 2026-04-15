import type {ValidationResult} from "../types";

// ── Primitive guards ──────────────────────────────────────────────────────────

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function isNonNegativeNumber(v: unknown): v is number {
  return isFiniteNumber(v) && (v as number) >= 0;
}

export function isEmail(v: unknown): v is string {
  return isNonEmptyString(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string);
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

// ── Builder helpers (chain with: return helperA() ?? helperB() ?? {valid: true}) ──

export function fail(error: string, field?: string): ValidationResult {
  return {valid: false, error, field};
}

export function requireStr(
  b: Record<string, unknown>, field: string, label?: string
): ValidationResult | null {
  return isNonEmptyString(b[field]) ? null : fail(`${label ?? field} is required.`, field);
}

export function requireNonNegNum(
  b: Record<string, unknown>, field: string
): ValidationResult | null {
  return isNonNegativeNumber(b[field]) ? null : fail(`${field} must be a non-negative number.`, field);
}

export function requireOneOf(
  b: Record<string, unknown>, field: string, values: readonly string[]
): ValidationResult | null {
  if (!isNonEmptyString(b[field]) || !(values as string[]).includes(b[field] as string)) {
    return fail(`${field} must be one of: ${values.join(", ")}.`, field);
  }
  return null;
}

export function optionalStringArray(
  b: Record<string, unknown>, field: string
): ValidationResult | null {
  if (b[field] === undefined) return null;
  if (!Array.isArray(b[field]) || (b[field] as unknown[]).some((v) => typeof v !== "string")) {
    return fail(`${field} must be an array of strings.`, field);
  }
  return null;
}
