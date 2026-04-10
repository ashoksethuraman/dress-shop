import { userApi } from './apiClient';
import { CartItem } from '../utils/types';

let cartTimer: ReturnType<typeof setTimeout> | null = null;
let wishlistTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 800;

export function scheduleSyncCart(
  items: CartItem[],
  isLoggedIn: boolean,
): void {
  if (!isLoggedIn) return;
  if (cartTimer) clearTimeout(cartTimer);
  cartTimer = setTimeout(async () => {
    cartTimer = null;
    try {
      await userApi.putCart(
        items.map(({ productId, qty, size }) => ({ productId, qty, size: size ?? null })),
      );
    } catch {
      // silent — localStorage is always the fallback
    }
  }, DEBOUNCE_MS);
}

export function scheduleSyncWishlist(
  ids: string[],
  isLoggedIn: boolean,
): void {
  if (!isLoggedIn) return;
  if (wishlistTimer) clearTimeout(wishlistTimer);
  wishlistTimer = setTimeout(async () => {
    wishlistTimer = null;
    try {
      await userApi.putWishlist(ids);
    } catch {
      // silent
    }
  }, DEBOUNCE_MS);
}
