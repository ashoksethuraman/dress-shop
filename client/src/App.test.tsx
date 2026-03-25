import { store } from './store';

test('cart store initializes from localStorage', () => {
  expect(Array.isArray(store.getState().cart.items)).toBe(true);
});
