import { configureStore, Middleware } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import cartReducer from './cartSlice';
import { saveCart, loadCart } from '../services/guestSession';
import { dressShopApi } from './apiSlice';

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
    [dressShopApi.reducerPath]: dressShopApi.reducer,
  },
  preloadedState: {
    cart: { items: loadCart() },
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(cartPersistMiddleware, dressShopApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
