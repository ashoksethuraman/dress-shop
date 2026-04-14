// ── Pricing constants — must stay in sync with functions/src/services/pricingService.ts ──
export const TAX_RATE      = 0.18;  // 18% GST
export const SHIPPING_FEE  = 49;    // flat ₹49
export const FREE_SHIPPING = 999;   // free above this subtotal

/** Compute the same totals the server will calculate. */
export function calcOrderTotals(subtotal: number) {
  const taxAmount   = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const shippingFee = subtotal >= FREE_SHIPPING ? 0 : SHIPPING_FEE;
  const totalAmount = parseFloat((subtotal + taxAmount + shippingFee).toFixed(2));
  return { taxAmount, shippingFee, totalAmount };
}

export const BADGE_COLORS: Record<string, string> = {
  budget:  'bg-green-100 text-green-700',
  mid:     'bg-yellow-100 text-yellow-700',
  premium: 'bg-brand text-brand-dark',
};

export function getPriceLevel(price: number) {
  if (price >= 75) return { level: 'Premium', className: 'premium' };
  if (price >= 50) return { level: 'Mid',     className: 'mid' };
  return                 { level: 'Budget',  className: 'budget' };
}
