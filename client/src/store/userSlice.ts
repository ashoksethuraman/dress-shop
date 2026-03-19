import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../utils/types';

type State = {
  user: User | null;
};

const initialState: State = { user: null };

const slice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
    },
    logout(state) {
      state.user = null;
    },
  },
});

export const { setUser, logout } = slice.actions;
export default slice.reducer;
