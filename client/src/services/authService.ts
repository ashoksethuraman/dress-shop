import type { User as AppUser } from '../utils/types';

/**
 * Non-sensitive user profile stored in localStorage
 * JWT is stored in HttpOnly cookie (never accessed here)
 */
const USER_META_KEY = '_user_meta';

/**
 * CSRF token lifetime (backend = 3600s)
 * We refresh 5 min early for safety
 */
const CSRF_TTL_MS = 55 * 60 * 1000;

/**
 * Tracks last CSRF fetch time (memory only)
 */
let _csrfFetchedAt: number | null = null;

/* =========================================================
   AUTH SERVICE
========================================================= */

export const authService = {
  /* ---------------- USER META ---------------- */

  saveUserMeta(user: AppUser): void {
    try {
      localStorage.setItem(USER_META_KEY, JSON.stringify(user));
    } catch {}
  },

  clearUserMeta(): void {
    try {
      localStorage.removeItem(USER_META_KEY);
    } catch {}
  },

  restoreUser(): AppUser | null {
    try {
      const raw = localStorage.getItem(USER_META_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AppUser;
    } catch {
      return null;
    }
  },

  /* ---------------- CSRF ---------------- */

  getCsrfToken(): string {
    try {
      return (
        document.cookie
          .split(';')
          .find((c) => c.trim().startsWith('XSRF-TOKEN='))
          ?.split('=')[1]
          ?.trim() ?? ''
      );
    } catch {
      return '';
    }
  },

  /**
   * CSRF is valid only if:
   * 1. cookie exists
   * 2. it was fetched recently
   */
  isCsrfValid(): boolean {
    const token = authService.getCsrfToken();
    if (!token) return false;

    if (_csrfFetchedAt === null) return false;

    return Date.now() - _csrfFetchedAt < CSRF_TTL_MS;
  },

  markCsrfFetched(): void {
    _csrfFetchedAt = Date.now();
  },

  clearCsrf(): void {
    _csrfFetchedAt = null;
  },

  /* ---------------- GUEST ---------------- */

  signInGuest(): AppUser {
    const id = `guest_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    return {
      id,
      name: 'Guest',
      isGuest: true,
      isAdmin: false,
    };
  },

  /* ---------------- SIGN OUT ---------------- */

  signOut(): void {
    authService.clearUserMeta();
    authService.clearCsrf();
  },
};