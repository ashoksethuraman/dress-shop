import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CartItem } from '../utils/types';

type State = {
  items: CartItem[];
};

const initialState: State = { items: [] };

const slice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart(state, action: PayloadAction<CartItem>) {
      const item = action.payload;
      const found = state.items.find((i) => i.productId === item.productId);
      if (found) {
        found.qty += item.qty;
      } else {
        state.items.push(item);
      }
    },
    removeFromCart(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.productId !== action.payload);
    },
    clearCart(state) {
      state.items = [];
    },
    setQty(state, action: PayloadAction<{ productId: string; qty: number }>) {
      const f = state.items.find((i) => i.productId === action.payload.productId);
      if (f) f.qty = action.payload.qty;
    },
  },
});

export const { addToCart, removeFromCart, clearCart, setQty } = slice.actions;
export default slice.reducer;
