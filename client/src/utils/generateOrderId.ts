export function generateOrderId(): string {
  return `ORD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
