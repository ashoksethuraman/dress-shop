import { OrderStatus, PaymentStatus, RefundStatus } from '../../utils/apiTypes';

export const PAGE_SIZE = 10;

export function orderStatusBadge(s: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    PENDING:        'bg-amber-50 text-amber-700 border border-amber-200',
    PLACED:         'bg-brand text-brand-dark border border-brand-border',
    CONFIRMED:      'bg-blue-50 text-blue-700 border border-blue-200',
    PROCESSING:     'bg-violet-50 text-violet-700 border border-violet-200',
    SHIPPED:        'bg-cyan-50 text-cyan-700 border border-cyan-200',
    DELIVERED:      'bg-green-50 text-green-700 border border-green-200',
    CANCELLED:      'bg-red-50 text-red-600 border border-red-200',
    PAYMENT_FAILED: 'bg-red-50 text-red-600 border border-red-200',
  };
  return map[s] ?? 'bg-gray-100 text-gray-600';
}

export function paymentStatusBadge(s: PaymentStatus): string {
  const map: Record<PaymentStatus, string> = {
    PENDING:   'bg-amber-50 text-amber-700 border border-amber-200',
    SUCCESS:   'bg-green-50 text-green-700 border border-green-200',
    FAILED:    'bg-red-50 text-red-600 border border-red-200',
    CANCELLED: 'bg-red-50 text-red-600 border border-red-200',
    REFUNDED:  'bg-purple-50 text-purple-700 border border-purple-200',
  };
  return map[s] ?? 'bg-gray-100 text-gray-600';
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function refundStatusBadge(s: RefundStatus): string {
  const map: Record<RefundStatus, string> = {
    NONE:        'bg-gray-100 text-gray-500 border border-gray-200',
    INITIATED:   'bg-amber-50 text-amber-700 border border-amber-200',
    PROCESSING:  'bg-blue-50 text-blue-700 border border-blue-200',
    COMPLETED:   'bg-purple-50 text-purple-700 border border-purple-200',
    FAILED:      'bg-red-50 text-red-600 border border-red-200',
  };
  return map[s] ?? 'bg-gray-100 text-gray-600';
}
