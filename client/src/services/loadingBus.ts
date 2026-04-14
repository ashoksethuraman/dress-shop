type Listener = (count: number) => void;

let count = 0;
const listeners = new Set<Listener>();

export const loadingBus = {
  /** Subscribe to count changes. Returns an unsubscribe function. */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  increment() {
    count += 1;
    listeners.forEach((fn) => fn(count));
  },
  decrement() {
    count = Math.max(0, count - 1);
    listeners.forEach((fn) => fn(count));
  },
  getCount() {
    return count;
  },
};
