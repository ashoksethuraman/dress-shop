export const BADGE_COLORS: Record<string, string> = {
  budget:  'bg-green-100 text-green-700',
  mid:     'bg-yellow-100 text-yellow-700',
  premium: 'bg-indigo-100 text-indigo-700',
};

export function getPriceLevel(price: number) {
  if (price >= 75) return { level: 'Premium', className: 'premium' };
  if (price >= 50) return { level: 'Mid',     className: 'mid' };
  return                 { level: 'Budget',  className: 'budget' };
}
