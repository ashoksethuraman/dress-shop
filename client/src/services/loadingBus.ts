type Listener = (count: number) => void;

let count = 0;
let listener: Listener | null = null;

export const loadingBus = {
  subscribe(fn: Listener) {
    listener = fn;
  },
  unsubscribe() {
    listener = null;
  },
  increment() {
    count += 1;
    listener?.(count);
  },
  decrement() {
    count = Math.max(0, count - 1);
    listener?.(count);
  },
  getCount() {
    return count;
  },
};
