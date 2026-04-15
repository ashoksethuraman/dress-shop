import * as crypto from "crypto";
import type {Response} from "express";

const IS_PROD = process.env.NODE_ENV === "production";

function cookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    secure: IS_PROD,
    sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
    maxAge: 3600 * 1000,
    path: "/",
  };
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function setAuthCookies(res: Response, sessionJwt: string, csrfToken: string): void {
  res.cookie("__session", sessionJwt, cookieOptions(true));
  res.cookie("XSRF-TOKEN", csrfToken, cookieOptions(false));
}

export function clearAuthCookies(res: Response): void {
  const base = {
    path: "/", maxAge: 0, httpOnly: false,
    secure: IS_PROD, sameSite: IS_PROD ? ("none" as const) : ("lax" as const),
  };
  res.cookie("__session", "", {...base, httpOnly: true});
  res.cookie("XSRF-TOKEN", "", base);
}
