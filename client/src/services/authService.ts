import type { User as AppUser } from '../utils/types';

// Non-sensitive user profile stored in localStorage so the UI restores
// immediately on page reload without waiting for GET /users/me.
// The JWT itself is in an HttpOnly cookie and never touches JavaScript.
const USER_META_KEY = '_user_meta';

// CSRF token lifetime: backend sets maxAge = 3600 s.
// We treat it as valid for 55 min so we refresh 5 min before hard expiry.
const CSRF_TTL_MS = 55 * 60 * 1000;

// In-memory timestamp of the last successful CSRF cookie fetch.
// Resets on page reload (safe — the cookie itself persists across reloads,
// but recording the age lets us proactively refresh before it expires).
let _csrfFetchedAt: number | null = null;

export const authService = {
  /** Persist non-sensitive user profile (no token) to localStorage. */
  saveUserMeta(user: AppUser): void {
    try {
      localStorage.setItem(USER_META_KEY, JSON.stringify(user));
    } catch { /* private mode / storage full */ }
  },

  /** Clear stored user profile on logout. */
  clearUserMeta(): void {
    try { localStorage.removeItem(USER_META_KEY); } catch { /* ignore */ }
  },

  /**
   * Synchronously restore the user profile from localStorage.
   * Returns null if nothing is stored (first visit or after logout).
   * The session validity is confirmed by the backend via GET /users/me on mount.
   */
  restoreUser(): AppUser | null {
    try {
      const raw = localStorage.getItem(USER_META_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AppUser;
    } catch {
      return null;
    }
  },

  /**
   * Read the XSRF-TOKEN cookie value set by the server (non-HttpOnly).
   * Returns an empty string if the cookie is absent or expired.
   */
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
   * Returns true when an XSRF-TOKEN cookie exists AND was fetched within
   * the last 55 minutes (5 min before the server's 1-hour hard expiry).
   * When false the caller should fetch a fresh token.
   */
  isCsrfValid(): boolean {
    if (!authService.getCsrfToken()) return false;          // cookie gone / expired
    if (_csrfFetchedAt === null) return false;              // page reloaded — re-verify age
    return (Date.now() - _csrfFetchedAt) < CSRF_TTL_MS;
  },

  /** Call after a successful GET /users/csrf-token (or login/signup). */
  markCsrfFetched(): void {
    _csrfFetchedAt = Date.now();
  },

  /** Invalidate the in-memory age tracker (e.g. on logout). */
  clearCsrf(): void {
    _csrfFetchedAt = null;
  },

  signInGuest(): AppUser {
    const id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return { id, name: 'Guest', isGuest: true, isAdmin: false };
  },

  signOut(): void {
    authService.clearUserMeta();
    authService.clearCsrf();
  },
};

