import { configureStore, Middleware } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import cartReducer from './cartSlice';
import { saveCart, loadCart } from '../services/guestSession';

// Auto-persist cart slice to localStorage on every cart action so guests
// never lose their cart on refresh, tab close, or back-navigation.
const cartPersistMiddleware: Middleware = (storeAPI) => (next) => (action) => {
  const result = next(action);
  if ((action as any).type?.startsWith('cart/')) {
    saveCart(storeAPI.getState().cart.items);
  }
  return result;
};

export const store = configureStore({
  reducer: {
    user: userReducer,
    cart: cartReducer,
  },
  // Hydrate cart from localStorage on app boot
  preloadedState: {
    cart: { items: loadCart() },
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(cartPersistMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
