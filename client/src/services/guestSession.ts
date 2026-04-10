import { CartItem, CheckoutFormState } from '../utils/types';


const K = {
  CART:           'ds_cart',
  WISHLIST:       'ds_wishlist',
  CHECKOUT_FORM:  'ds_checkout_form',
} as const;


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
    // ignore
  }
}

function remove(key: string): void {
  try { localStorage.removeItem(key); } catch { }
}


export function saveCart(items: CartItem[]): void {
  write(K.CART, items);
}

export function loadCart(): CartItem[] {
  return read<CartItem[]>(K.CART) ?? [];
}

export function clearCartItems(): void {
  remove(K.CART);
}


export function saveWishlist(ids: string[]): void {
  write(K.WISHLIST, ids);
}

export function loadWishlist(): string[] {
  return read<string[]>(K.WISHLIST) ?? [];
}

export function clearWishlistItems(): void {
  remove(K.WISHLIST);
}

/** Called on logout of a real (non-guest) user — wipe cart + wishlist from localStorage. */
export function clearUserSession(): void {
  remove(K.CART);
  remove(K.WISHLIST);
}

type PersistedCheckoutForm = Pick<
  CheckoutFormState,
  'email' | 'shippingAddress' | 'billingAddress' | 'billingOption'
>;

export function saveCheckoutForm(data: Partial<PersistedCheckoutForm>): void {
  const existing = read<Partial<PersistedCheckoutForm>>(K.CHECKOUT_FORM) ?? {};
  write(K.CHECKOUT_FORM, { ...existing, ...data });
}

export function loadCheckoutForm(): Partial<PersistedCheckoutForm> | null {
  return read<Partial<PersistedCheckoutForm>>(K.CHECKOUT_FORM);
}


