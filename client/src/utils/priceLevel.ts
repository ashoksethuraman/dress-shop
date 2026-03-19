export function getPriceLevel(price: number) {
  if (price >= 75) return { level: 'Premium', className: 'badge-premium' };
  if (price >= 50) return { level: 'Mid', className: 'badge-mid' };
  return { level: 'Budget', className: 'badge-budget' };
}
