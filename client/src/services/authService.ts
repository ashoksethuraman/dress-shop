import type { User as AppUser } from '../utils/types';

// ── Custom JWT storage ────────────────────────────────────────────────────────
const JWT_STORAGE_KEY = '_cjwt';
let _customJwt: string | null = null;
try { _customJwt = localStorage.getItem(JWT_STORAGE_KEY); } catch { /* SSR / private mode */ }

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isJwtExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload) return true;
  const exp = payload['exp'] as number | undefined;
  if (!exp) return false;
  return Date.now() / 1000 >= exp;
}

export const authService = {
  setCustomJwt(token: string | null): void {
    _customJwt = token;
    try {
      token
        ? localStorage.setItem(JWT_STORAGE_KEY, token)
        : localStorage.removeItem(JWT_STORAGE_KEY);
    } catch { /* ignore */ }
  },

  getCustomJwt(): string | null {
    return _customJwt;
  },

  async getIdToken(_forceRefresh = false): Promise<string | null> {
    if (_customJwt && !isJwtExpired(_customJwt)) return _customJwt;
    return null;
  },

  restoreUser(): AppUser | null {
    if (!_customJwt || isJwtExpired(_customJwt)) {
      if (_customJwt) authService.setCustomJwt(null); // clean up expired token
      return null;
    }
    const payload = parseJwtPayload(_customJwt);
    if (!payload) return null;
    return {
      id:      payload['userId'] as string,
      name:    payload['username'] as string | undefined,
      isGuest: false,
      isAdmin: payload['role'] === 'admin',
    };
  },

  signInGuest(): AppUser {
    const id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return { id, name: 'Guest', isGuest: true, isAdmin: false };
  },

  signOut(): void {
    authService.setCustomJwt(null);
  },
};

