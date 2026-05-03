export const ORDER_STATUSES = [
  "PENDING", "PLACED", "CONFIRMED", "PROCESSING", "SHIPPED",
  "DELIVERED", "CANCELLED", "PAYMENT_FAILED",
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const PAYMENT_STATUSES = [
  "PENDING", "SUCCESS", "FAILED", "CANCELLED", "REFUNDED",
] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const REFUND_STATUSES = [
  "NONE", "INITIATED", "PROCESSING", "COMPLETED", "FAILED",
] as const;
export type RefundStatus = typeof REFUND_STATUSES[number];

export const FAIL_REASONS = ["payment_dismissed", "payment_failed"] as const;
export type FailReason = typeof FAIL_REASONS[number];

export const PRODUCT_CATEGORIES = ["men", "women"] as const;
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const STOCK_STATUSES = ["available", "out_of_stock"] as const;
export type StockStatus = typeof STOCK_STATUSES[number];
