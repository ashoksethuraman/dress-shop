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
      // Match by productId AND (size OR ageSize) so different sizes/ages are separate cart entries
      const found = state.items.find(
        (i) => i.productId === item.productId && 
               (i.size ?? null) === (item.size ?? null) &&
               (i.ageSize ?? null) === (item.ageSize ?? null)
      );
      if (found) {
        const cap = found.maxQty ?? item.maxQty ?? Infinity;
        found.qty = Math.min(found.qty + item.qty, cap);
        if (item.maxQty !== undefined) found.maxQty = item.maxQty;
      } else {
        state.items.push(item);
      }
    },
    removeFromCart(state, action: PayloadAction<{ productId: string; size?: string | null; ageSize?: string | null }>) {
      const { productId, size, ageSize } = action.payload;
      state.items = state.items.filter(
        (i) => !(i.productId === productId && 
                 (i.size ?? null) === (size ?? null) &&
                 (i.ageSize ?? null) === (ageSize ?? null))
      );
    },
    clearCart(state) {
      state.items = [];
    },
    setQty(state, action: PayloadAction<{ productId: string; size?: string | null; ageSize?: string | null; qty: number }>) {
      const { productId, size, ageSize, qty } = action.payload;
      const f = state.items.find(
        (i) => i.productId === productId && 
               (i.size ?? null) === (size ?? null) &&
               (i.ageSize ?? null) === (ageSize ?? null)
      );
      if (f) f.qty = f.maxQty !== undefined ? Math.min(qty, f.maxQty) : qty;
    },
  },
});

export const { addToCart, removeFromCart, clearCart, setQty } = slice.actions;
export default slice.reducer;
