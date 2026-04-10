import { configureStore, Middleware } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import cartReducer from './cartSlice';
import wishlistReducer from './wishlistSlice';
import { saveCart, loadCart, saveWishlist, loadWishlist } from '../services/guestSession';
import { scheduleSyncCart, scheduleSyncWishlist } from '../services/syncService';
import { dressShopApi } from './apiSlice';

const cartPersistMiddleware: Middleware = (storeAPI) => (next) => (action) => {
  const result = next(action);
  if ((action as { type?: string }).type?.startsWith('cart/')) {
    const state = storeAPI.getState() as RootState;
    const items = state.cart.items;
    saveCart(items);
    const isLoggedIn = !!(state.user.user && !state.user.user.isGuest);
    scheduleSyncCart(items, isLoggedIn);
  }
  return result;
};

const wishlistPersistMiddleware: Middleware = (storeAPI) => (next) => (action) => {
  const result = next(action);
  const type = (action as { type?: string }).type;
  if (type?.startsWith('wishlist/')) {
    const state = storeAPI.getState() as RootState;
    const ids = state.wishlist.ids;
    saveWishlist(ids);
    // Only sync to backend on explicit user toggle — not on bulk setWishlist/clearWishlist (system ops)
    if (type === 'wishlist/toggleWishlist') {
      const isLoggedIn = !!(state.user.user && !state.user.user.isGuest);
      scheduleSyncWishlist(ids, isLoggedIn);
    }
  }
  return result;
};

export const store = configureStore({
  reducer: {
    user: userReducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
    [dressShopApi.reducerPath]: dressShopApi.reducer,
  },
  preloadedState: {
    cart: { items: loadCart() },
    wishlist: { ids: loadWishlist() },
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      cartPersistMiddleware,
      wishlistPersistMiddleware,
      dressShopApi.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
