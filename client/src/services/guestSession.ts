/**
 * guestSession — local-first guest data persistence.
 *
 * Everything is browser-scoped (localStorage) so guests can refresh or close
 * a tab without losing their cart, address, or checkout progress.
 *
 * Design rules:
 *  • All reads/writes are wrapped in try/catch — localStorage can throw in
 *    private-browsing mode or when storage quota is exceeded.
 *  • Cart is cleared after a successful order; address/email is kept so the
 *    guest doesn't have to re-enter it on a future purchase.
 *  • Firestore writes are NOT made from this module — this is client-only.
 */

import { CartItem, CheckoutFormState } from '../utils/types';

// ── Storage keys ──────────────────────────────────────────────────────────────
const K = {
  CART:           'ds_cart',
  CHECKOUT_FORM:  'ds_checkout_form',
} as const;

// ── Internal helpers ──────────────────────────────────────────────────────────
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private-browsing restriction — silently ignore.
  }
}

function remove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ── Cart ──────────────────────────────────────────────────────────────────────
/** Save the full cart item array. Called automatically by Redux middleware. */
export function saveCart(items: CartItem[]): void {
  write(K.CART, items);
}

/**
 * Load persisted cart items for Redux `preloadedState` on app boot.
 * Returns an empty array when nothing is stored.
 */
export function loadCart(): CartItem[] {
  return read<CartItem[]>(K.CART) ?? [];
}

/**
 * Remove only the cart from localStorage after a successful order.
 * Address and guest ID are intentionally preserved.
 */
export function clearCartItems(): void {
  remove(K.CART);
}

// ── Checkout form (email · addresses · billing option) ────────────────────────
type PersistedCheckoutForm = Pick<
  CheckoutFormState,
  'email' | 'shippingAddress' | 'billingAddress' | 'billingOption'
>;

/**
 * Persist checkout form data.
 * Merges with any previously saved data so partial saves don't overwrite
 * unrelated fields (e.g. saving only email won't wipe the address).
 */
export function saveCheckoutForm(data: Partial<PersistedCheckoutForm>): void {
  const existing = read<Partial<PersistedCheckoutForm>>(K.CHECKOUT_FORM) ?? {};
  write(K.CHECKOUT_FORM, { ...existing, ...data });
}

/**
 * Load saved checkout form data to pre-populate the form on return visits.
 * Returns null on first visit.
 */
export function loadCheckoutForm(): Partial<PersistedCheckoutForm> | null {
  return read<Partial<PersistedCheckoutForm>>(K.CHECKOUT_FORM);
}


