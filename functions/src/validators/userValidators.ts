import type {ValidationResult} from "../types";
import {isObject, isNonEmptyString, isEmail, requireStr, fail} from "./helpers";

const STRONG_PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,}$/;

const PHONE_RE = /^\+?[0-9]{10,15}$/;

const UID_RE = /^[\w\-.]{1,128}$/;

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

  if (
    typeof body.age !== "number" ||
    !Number.isInteger(body.age) ||
    body.age < 13 ||
    body.age > 120
  ) {
    return fail("Age must be an integer between 13 and 120.", "age");
  }

  if (body.gender !== "male" && body.gender !== "female") {
    return fail("Gender must be 'male' or 'female'.", "gender");
  }

  if (
    !isNonEmptyString(body.mobileNumber) ||
    !PHONE_RE.test((body.mobileNumber as string).trim())
  ) {
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

export function validateUpdateProfile(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");

  const ALLOWED = new Set(["displayName", "phone", "photoURL"]);
  const extra = Object.keys(body).filter((k) => !ALLOWED.has(k));
  if (extra.length > 0) return fail(`Unexpected field(s): ${extra.join(", ")}.`);

  if (body.displayName !== undefined) {
    if (!isNonEmptyString(body.displayName)) {
      return fail("displayName must be a non-empty string.", "displayName");
    }
    const len = (body.displayName as string).trim().length;
    if (len < 1 || len > 100) return fail("displayName must be 1–100 characters.", "displayName");
  }

  if (
    body.phone !== undefined &&
    (typeof body.phone !== "string" || !/^\+[1-9]\d{6,14}$/.test(body.phone as string))
  ) {
    return fail("phone must be in E.164 format (e.g. +919876543210).", "phone");
  }

  if (body.photoURL !== undefined) {
    if (!isNonEmptyString(body.photoURL)) return fail("photoURL must be a non-empty string.", "photoURL");
    if (!(body.photoURL as string).startsWith("https://")) {
      return fail("photoURL must be an https URL.", "photoURL");
    }
    if ((body.photoURL as string).length > 2048) return fail("photoURL is too long.", "photoURL");
  }

  if (
    body.displayName === undefined &&
    body.phone === undefined &&
    body.photoURL === undefined
  ) {
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

export function validateBulkStatusUpdate(body: unknown): ValidationResult {
  if (!isObject(body)) return fail("Request body is required.");

  if (!Array.isArray(body.uids) || body.uids.length === 0) {
    return fail("uids must be a non-empty array.", "uids");
  }
  if (body.uids.length > 100) {
    return fail("Cannot update more than 100 users at once.", "uids");
  }
  for (const uid of body.uids as unknown[]) {
    if (typeof uid !== "string" || !UID_RE.test(uid)) {
      return fail("All uids must be valid non-empty strings.", "uids");
    }
  }
  if (typeof body.isActive !== "boolean") {
    return fail("isActive must be a boolean.", "isActive");
  }

  const ALLOWED = new Set(["uids", "isActive"]);
  const extra = Object.keys(body).filter((k) => !ALLOWED.has(k));
  if (extra.length > 0) return fail(`Unexpected field(s): ${extra.join(", ")}.`);

  return {valid: true};
}
