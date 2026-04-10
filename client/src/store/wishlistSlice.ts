import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type State = {
  ids: string[]; // productIds
};

const initialState: State = { ids: [] };

const slice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    toggleWishlist(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.ids.indexOf(id);
      if (idx === -1) {
        state.ids.push(id);
      } else {
        state.ids.splice(idx, 1);
      }
    },
    setWishlist(state, action: PayloadAction<string[]>) {
      state.ids = action.payload;
    },
    clearWishlist(state) {
      state.ids = [];
    },
  },
});

export const { toggleWishlist, setWishlist, clearWishlist } = slice.actions;
export default slice.reducer;
