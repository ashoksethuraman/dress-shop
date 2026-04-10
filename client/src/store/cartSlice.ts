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
      // Match by both productId AND size so different sizes are separate cart entries
      const found = state.items.find(
        (i) => i.productId === item.productId && (i.size ?? null) === (item.size ?? null)
      );
      if (found) {
        const cap = found.maxQty ?? item.maxQty ?? Infinity;
        found.qty = Math.min(found.qty + item.qty, cap);
        if (item.maxQty !== undefined) found.maxQty = item.maxQty;
      } else {
        state.items.push(item);
      }
    },
    removeFromCart(state, action: PayloadAction<{ productId: string; size?: string | null }>) {
      const { productId, size } = action.payload;
      state.items = state.items.filter(
        (i) => !(i.productId === productId && (i.size ?? null) === (size ?? null))
      );
    },
    clearCart(state) {
      state.items = [];
    },
    setQty(state, action: PayloadAction<{ productId: string; size?: string | null; qty: number }>) {
      const { productId, size, qty } = action.payload;
      const f = state.items.find(
        (i) => i.productId === productId && (i.size ?? null) === (size ?? null)
      );
      if (f) f.qty = f.maxQty !== undefined ? Math.min(qty, f.maxQty) : qty;
    },
  },
});

export const { addToCart, removeFromCart, clearCart, setQty } = slice.actions;
export default slice.reducer;
