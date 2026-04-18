import { OrderStatus } from './apiTypes';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Linear progression of non-terminal order statuses.
 * Status may only advance forward in this list; no reversals.
 */
export const ORDER_FORWARD_SEQUENCE: OrderStatus[] = [
  'PENDING', 'PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:        'Pending',
  PLACED:         'Placed',
  CONFIRMED:      'Confirmed',
  PROCESSING:     'Processing',
  SHIPPED:        'Shipped',
  DELIVERED:      'Delivered',
  CANCELLED:      'Cancelled',
  PAYMENT_FAILED: 'Payment Failed',
};

/** Statuses from which no further transitions are allowed. */
export const TERMINAL_STATUSES = new Set<OrderStatus>(['DELIVERED', 'CANCELLED']);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StatusOption {
  value: OrderStatus;
  label: string;
  /** When present the option must be shown but the Update button must be disabled. */
  blockedReason?: string;
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true when the `from → to` transition is a legal forward move.
 *
 * Rules:
 *  - Cannot stay on the same status.
 *  - Terminal statuses (DELIVERED, CANCELLED) cannot be changed further.
 *  - PAYMENT_FAILED orders can only move to CANCELLED.
 *  - CANCELLED is reachable from any pre-shipped status (not SHIPPED/DELIVERED).
 *  - All other moves must advance forward in ORDER_FORWARD_SEQUENCE.
 */
export function isLegalTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (TERMINAL_STATUSES.has(from)) return false;
  if (from === 'PAYMENT_FAILED') return to === 'CANCELLED';
  if (to === 'CANCELLED') {
    return from !== 'SHIPPED' && from !== 'DELIVERED';
  }
  const fi = ORDER_FORWARD_SEQUENCE.indexOf(from);
  const ti = ORDER_FORWARD_SEQUENCE.indexOf(to);
  return fi >= 0 && ti > fi;
}

/**
 * Returns the set of statuses an admin may transition `current` to.
 *
 * @param current       – present order status
 * @param paymentStatus – payment status string from the order (e.g. 'SUCCESS')
 * @param isCOD         – true when payment method is Cash on Delivery
 *
 * Returned options that would be blocked by business rules (e.g. unpaid order
 * cannot be shipped) are included but have `blockedReason` set so the UI can
 * display them as disabled with an explanatory tooltip.
 */
export function getAllowedTransitions(
  current: OrderStatus,
  paymentStatus: string,
  isCOD: boolean,
): StatusOption[] {
  if (TERMINAL_STATUSES.has(current)) return [];

  const paymentOk = paymentStatus === 'SUCCESS' || isCOD;

  if (current === 'PAYMENT_FAILED') {
    return [{ value: 'CANCELLED', label: ORDER_STATUS_LABELS.CANCELLED }];
  }

  const currentIdx = ORDER_FORWARD_SEQUENCE.indexOf(current);
  const options: StatusOption[] = [];

  for (let i = currentIdx + 1; i < ORDER_FORWARD_SEQUENCE.length; i++) {
    const s = ORDER_FORWARD_SEQUENCE[i];
    if ((s === 'SHIPPED' || s === 'DELIVERED') && !paymentOk) {
      options.push({ value: s, label: ORDER_STATUS_LABELS[s], blockedReason: 'Payment not completed' });
    } else {
      options.push({ value: s, label: ORDER_STATUS_LABELS[s] });
    }
  }

  // CANCELLED is reachable from any pre-shipped non-terminal status
  if (current !== 'SHIPPED') {
    options.push({ value: 'CANCELLED', label: ORDER_STATUS_LABELS.CANCELLED });
  }

  return options;
}

/**
 * Given a target status and a list of orders, partitions them into:
 * - `eligible`   – orders where the transition is legal (used for bulk update)
 * - `skipped`    – orders already at that status or in a terminal/incompatible state
 * - `blocked`    – orders blocked specifically by the payment requirement
 *
 * `paymentResolver` returns { paymentStatus, isCOD } for a given order.
 */
export interface BulkPartition {
  eligible: string[];   // order IDs that CAN be updated
  skipped:  string[];   // already at target / terminal
  blocked:  string[];   // payment-gated (unpaid, non-COD)
}

export function partitionBulkUpdate(
  orderIds: string[],
  targetStatus: OrderStatus,
  getOrder: (id: string) => { orderStatus: OrderStatus; paymentStatus: string; isCOD: boolean } | undefined,
): BulkPartition {
  const eligible: string[] = [];
  const skipped:  string[] = [];
  const blocked:  string[] = [];

  for (const id of orderIds) {
    const order = getOrder(id);
    if (!order) { skipped.push(id); continue; }

    const { orderStatus, paymentStatus, isCOD } = order;

    if (!isLegalTransition(orderStatus, targetStatus)) {
      skipped.push(id);
      continue;
    }

    // Payment gate for SHIPPED / DELIVERED
    if ((targetStatus === 'SHIPPED' || targetStatus === 'DELIVERED') &&
        paymentStatus !== 'SUCCESS' && !isCOD) {
      blocked.push(id);
      continue;
    }

    eligible.push(id);
  }

  return { eligible, skipped, blocked };
}
