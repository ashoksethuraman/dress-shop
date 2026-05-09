import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiLoader, FiCheckCircle, FiAlertCircle,
  FiRefreshCw, FiPackage, FiClock, FiMapPin, FiMail, FiX, FiLock,
} from 'react-icons/fi';
import { ordersApi, paymentsApi } from '../services/apiClient';
import { StoredOrder, OrderStatus, RefundStatus } from '../utils/apiTypes';
import { formatPrice } from '../utils/format';
import {
  orderStatusBadge, paymentStatusBadge, refundStatusBadge, fmtDate, fmtDateTime,
} from '../components/admin/adminHelpers';
import AlertModal from '../components/AlertModal';
import { useAppSelector } from '../store/hooks';
import {
  TERMINAL_STATUSES, ORDER_STATUS_LABELS, getAllowedTransitions,
  type StatusOption,
} from '../utils/orderStatusMachine';

// ── Inline refund confirmation modal ─────────────────────────────────────────
interface RefundModalProps {
  order: StoredOrder;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

function RefundConfirmModal({ order, onClose, onConfirm, loading, error }: RefundModalProps) {
  const [reason, setReason] = useState('');
  return (
    <div
      className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border-b border-red-200">
          <FiRefreshCw size={20} className="text-red-500" />
          <h2 className="font-bold text-base text-red-800 flex-1">Confirm Refund</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-sm text-gray-700">
            This will initiate a full refund of{' '}
            <strong>{formatPrice(order.totalAmount)}</strong> to the customer via Razorpay.
            This action <strong>cannot be undone</strong>.
          </p>

          <div className="bg-gray-50 rounded-xl border border-gray-200 px-3 py-3 text-xs text-gray-600 space-y-1">
            <p><span className="font-semibold">Order ID:</span>{' '}
              <span className="font-mono">{order.id}</span></p>
            <p><span className="font-semibold">Customer:</span> {order.contactEmail ?? '—'}</p>
            <p><span className="font-semibold">Refund Amount:</span> {formatPrice(order.totalAmount)}</p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted/70 uppercase tracking-wider mb-1 block">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Stored in the order timeline…"
              rows={3}
              disabled={loading}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-red-400 focus:ring-red-200 resize-none disabled:opacity-60"
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <FiAlertCircle size={13} /> {error}
            </p>
          )}
        </div>

        <div className="px-5 pb-5 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
          >
            {loading
              ? <><FiLoader size={13} className="animate-spin" /> Processing…</>
              : <><FiRefreshCw size={13} /> Confirm Refund</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Read-only input field ─────────────────────────────────────────────────────
function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-muted/70 uppercase tracking-wider mb-1">{label}</p>
      <input
        readOnly
        value={value}
        className="w-full border border-gray-100 bg-brand rounded-lg px-3 py-2 text-sm text-primary cursor-default focus:outline-none"
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate    = useNavigate();
  const currentUser = useAppSelector(s => s.user.user);

  const [order,       setOrder]       = useState<StoredOrder | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [pageError,   setPageError]   = useState<string | null>(null);

  // Status update
  const [selStatus,     setSelStatus]     = useState<OrderStatus | ''>('');
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [liveStatus,    setLiveStatus]    = useState<OrderStatus>('PENDING');
  const [updating,      setUpdating]      = useState(false);
  const [statusMsg,     setStatusMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  // Refund
  const [liveRefund,     setLiveRefund]     = useState<RefundStatus>('NONE');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundLoading,  setRefundLoading]  = useState(false);
  const [refundError,    setRefundError]    = useState<string | null>(null);
  const [refundDone,     setRefundDone]     = useState(false);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    ordersApi.getById(orderId)
      .then((o) => {
        setOrder(o);
        setLiveStatus(o.orderStatus);
        setSelStatus('');
        setLiveRefund(o.refundStatus ?? 'NONE');
      })
      .catch(e => setPageError(e?.message ?? 'Failed to load order.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleStatusConfirm = async () => {
    if (!orderId || !pendingStatus) return;
    setUpdating(true);
    setStatusMsg(null);
    try {
      await ordersApi.updateStatus(orderId, pendingStatus);
      setLiveStatus(pendingStatus);
      setSelStatus(pendingStatus);
      setOrder(prev => prev ? { ...prev, orderStatus: pendingStatus } : prev);
      setStatusMsg({ ok: true, text: `Status updated to ${pendingStatus.replace(/_/g, ' ')}.` });
    } catch (e: any) {
      setStatusMsg({ ok: false, text: e?.message ?? 'Failed to update status.' });
    } finally {
      setUpdating(false);
      setPendingStatus(null);
    }
  };

  const handleRefund = async (reason: string) => {
    if (!orderId) return;
    setRefundLoading(true);
    setRefundError(null);
    try {
      await paymentsApi.initiateRefund({ orderId, reason: reason.trim() || undefined });
      setLiveRefund('PROCESSING');
      setRefundDone(true);
      setShowRefundModal(false);
    } catch (e: any) {
      setRefundError(e?.message ?? 'Failed to initiate refund.');
    } finally {
      setRefundLoading(false);
    }
  };

  const paymentMethod = order?.paymentMethod ?? null;
  const isCOD =
    paymentMethod?.toLowerCase() === 'cod' ||
    paymentMethod?.toLowerCase() === 'cash on delivery';

  // ── Status-machine derived values ──────────────────────────────────────────
  const isOwnOrder = !!(order?.userId && currentUser && order.userId === currentUser.id);
  const isTerminal = TERMINAL_STATUSES.has(liveStatus);
  const allowedOptions = order
    ? getAllowedTransitions(liveStatus, order.paymentStatus, isCOD)
    : [];
  const canUpdateStatus = !isOwnOrder && !isTerminal && allowedOptions.length > 0;

  const isRefundEligible =
    order?.paymentStatus === 'SUCCESS' &&
    !isCOD &&
    liveRefund === 'NONE' &&
    !['SHIPPED', 'DELIVERED'].includes(liveStatus);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FiLoader size={28} className="animate-spin text-brand-dark" />
      </div>
    );
  }

  // ── Error / not found ──────────────────────────────────────────────────────
  if (pageError || !order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <FiAlertCircle size={32} className="mx-auto mb-3 text-red-400" />
        <p className="text-red-600 font-semibold mb-4">{pageError ?? 'Order not found.'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2 rounded-xl bg-brand-dark text-white text-sm font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const shipAddr = !order.billingAndShippingSame ? order.shippingAddress : null;

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-6">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 mb-5 text-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-muted hover:text-primary transition-colors"
        >
          <FiArrowLeft size={16} /> Back
        </button>
        <span className="text-muted/40">/</span>
        <span className="text-xs text-muted font-mono truncate max-w-xs">{order.id}</span>
      </div>

      {/* ── Header card ── */}
      <div className="bg-brand rounded-2xl border border-brand-border px-5 py-4 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-brand-border/70 uppercase tracking-widest mb-0.5">Order ID</p>
            <p className="font-mono text-sm text-primary">{order.id}</p>
            <p className="text-xs text-muted mt-0.5">{fmtDate(order.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-bold ${orderStatusBadge(liveStatus)}`}>
              {liveStatus.replace(/_/g, ' ')}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-bold ${paymentStatusBadge(order.paymentStatus)}`}>
              {order.paymentStatus}
            </span>
            {liveRefund !== 'NONE' && (
              <span className={`text-xs px-3 py-1 rounded-full font-bold ${refundStatusBadge(liveRefund)}`}>
                Refund: {liveRefund}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ══ Left / main content ══════════════════════════════════════════════ */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Order summary fields */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-muted uppercase tracking-wide mb-4">Order Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <ReadField label="Subtotal"    value={formatPrice(order.subtotal)} />
              <ReadField label="Tax"         value={formatPrice(order.taxAmount)} />
              <ReadField label="Shipping"    value={formatPrice(order.shippingFee)} />
              <ReadField label="Discount"    value={order.discount ? `−${formatPrice(order.discount)}` : '—'} />
              <ReadField label="Total"       value={formatPrice(order.totalAmount)} />
              <ReadField label="Payment"     value={order.paymentStatus} />
            </div>
            {order.paymentId && (
              <div className="mt-3">
                <ReadField label="Payment ID" value={order.paymentId} />
              </div>
            )}
          </section>

          {/* Customer */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-muted uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <FiMail size={13} /> Customer
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReadField label="Email" value={order.contactEmail ?? '—'} />
              <ReadField
                label="Payment Method"
                value={paymentMethod === null ? 'Loading…' : (paymentMethod ?? 'N/A')}
              />
              {order.billingAddress && (
                <>
                  <ReadField label="Billing Name"  value={order.billingAddress.name}  />
                  <ReadField label="Phone"         value={order.billingAddress.phone} />
                </>
              )}
            </div>
          </section>

          {/* Addresses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {order.billingAddress && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <FiMapPin size={13} /> Billing Address
                </p>
                {([
                  ['Name',     order.billingAddress.name],
                  ['Line 1',   order.billingAddress.line1],
                  ['Line 2',   order.billingAddress.line2 ?? ''],
                  ['City',     order.billingAddress.city],
                  ['State',    order.billingAddress.state],
                  ['Pincode',  order.billingAddress.pincode],
                  ['Country',  order.billingAddress.country],
                ] as [string, string][]).filter(([, v]) => v).map(([lbl, val]) => (
                  <div key={lbl} className="mb-2">
                    <p className="text-[10px] font-bold text-muted/70 uppercase tracking-wider mb-0.5">{lbl}</p>
                    <input
                      readOnly value={val}
                      className="w-full border border-gray-100 bg-brand rounded-lg px-3 py-1.5 text-xs text-primary cursor-default focus:outline-none"
                    />
                  </div>
                ))}
              </section>
            )}

            {shipAddr && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <FiMapPin size={13} /> Shipping Address
                </p>
                {([
                  ['Name',     shipAddr.name],
                  ['Line 1',   shipAddr.line1],
                  ['Line 2',   shipAddr.line2 ?? ''],
                  ['City',     shipAddr.city],
                  ['State',    shipAddr.state],
                  ['Pincode',  shipAddr.pincode],
                  ['Country',  shipAddr.country],
                ] as [string, string][]).filter(([, v]) => v).map(([lbl, val]) => (
                  <div key={lbl} className="mb-2">
                    <p className="text-[10px] font-bold text-muted/70 uppercase tracking-wider mb-0.5">{lbl}</p>
                    <input
                      readOnly value={val}
                      className="w-full border border-gray-100 bg-brand rounded-lg px-3 py-1.5 text-xs text-primary cursor-default focus:outline-none"
                    />
                  </div>
                ))}
              </section>
            )}
          </div>

          {/* Items */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FiPackage size={13} /> Items ({order.items.length})
            </p>
            <div className="flex flex-col gap-2">
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-brand rounded-xl border border-brand-border/40 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-sm text-primary">{item.title}</p>
                    <p className="text-xs text-muted">
                      Qty: {item.qty}
                      {item.size ? ` · Size: ${item.size}` : ''} · {formatPrice(item.unitPrice)} each
                    </p>
                  </div>
                  <span className="font-extrabold text-sm text-accent shrink-0">
                    {formatPrice(item.total)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Timeline */}
          {(order.timeline ?? []).length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <FiClock size={13} /> Timeline
              </p>
              <div className="flex flex-col gap-2 border-l-2 border-brand-border ml-2 pl-4">
                {(order.timeline ?? []).map((t, i) => (
                  <div key={i} className="relative">
                    <span className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-brand-border border-2 border-white top-1" />
                    <p className="text-xs font-semibold text-primary">{t.status.replace(/_/g, ' ')}</p>
                    {t.note && <p className="text-xs text-muted">{t.note}</p>}
                    <p className="text-xs text-muted">{fmtDateTime(t.timestamp)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ══ Right / actions sidebar ══════════════════════════════════════════ */}
        <div className="flex flex-col gap-5">

          {/* Status update */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Update Order Status</p>

            <div className="flex flex-col gap-3">
              {/* Current badge */}
              <div>
                <p className="text-[10px] font-bold text-muted/70 uppercase tracking-wider mb-1">Current</p>
                <span className={`text-xs px-3 py-1 rounded-full font-bold ${orderStatusBadge(liveStatus)}`}>
                  {liveStatus.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Own-order lock */}
              {isOwnOrder && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <FiLock size={13} className="mt-0.5 flex-shrink-0" />
                  <span>You cannot manage your own orders. Another admin must handle this.</span>
                </div>
              )}

              {/* Terminal state info */}
              {!isOwnOrder && isTerminal && (
                <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <FiCheckCircle size={13} className="mt-0.5 flex-shrink-0" />
                  <span>This order is <strong>{liveStatus}</strong> — no further status changes are allowed.</span>
                </div>
              )}

              {/* Status selector */}
              {canUpdateStatus && (
                <>
                  <div>
                    <p className="text-[10px] font-bold text-muted/70 uppercase tracking-wider mb-1">Change To</p>
                    <select
                      value={selStatus}
                      onChange={e => { setSelStatus(e.target.value as OrderStatus | ''); setStatusMsg(null); }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:border-brand-dark focus:ring-brand transition-all"
                    >
                      <option value="" disabled>— Select next status —</option>
                      {allowedOptions.map(opt => (
                        <option
                          key={opt.value}
                          value={opt.value}
                          disabled={!!opt.blockedReason}
                          title={opt.blockedReason}
                        >
                          {opt.label}{opt.blockedReason ? ` (${opt.blockedReason})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment warning if any blocked option is selected */}
                  {selStatus && allowedOptions.find(o => o.value === selStatus)?.blockedReason && (
                    <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      <FiAlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                      <span>{allowedOptions.find(o => o.value === selStatus)?.blockedReason}. Complete payment before shipping.</span>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (selStatus && selStatus !== liveStatus) {
                        setPendingStatus(selStatus as OrderStatus);
                        setStatusMsg(null);
                      }
                    }}
                    disabled={
                      updating ||
                      !selStatus ||
                      selStatus === liveStatus ||
                      !!allowedOptions.find(o => o.value === selStatus)?.blockedReason
                    }
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-dark hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
                  >
                    {updating
                      ? <><FiLoader size={13} className="animate-spin" /> Updating…</>
                      : 'Update Status'}
                  </button>
                </>
              )}

              {statusMsg && (
                <p className={`flex items-center gap-1.5 text-xs ${statusMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {statusMsg.ok ? <FiCheckCircle size={13} /> : <FiAlertCircle size={13} />}
                  {statusMsg.text}
                </p>
              )}
            </div>
          </section>

          {/* Refund — only for Razorpay SUCCESS orders */}
          {order.paymentStatus === 'SUCCESS' && !isCOD && (
            <section className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
              <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <FiRefreshCw size={13} /> Refund
              </p>

              {/* Refund status badge */}
              {liveRefund !== 'NONE' && (
                <div className="mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${refundStatusBadge(liveRefund)}`}>
                    {liveRefund}
                  </span>
                  {liveRefund === 'PROCESSING' && (
                    <p className="mt-2 text-xs text-muted">Razorpay is processing — status updates via webhook.</p>
                  )}
                  {liveRefund === 'COMPLETED' && (
                    <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                      <FiCheckCircle size={12} /> Refund of {formatPrice(order.totalAmount)} completed.
                    </p>
                  )}
                  {liveRefund === 'FAILED' && (
                    <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                      <FiAlertCircle size={12} /> Failed — contact Razorpay support.
                    </p>
                  )}
                </div>
              )}

              {/* Success banner */}
              {refundDone && (
                <div className="mb-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                  <FiCheckCircle size={14} className="flex-shrink-0" />
                  Refund of {formatPrice(order.totalAmount)} initiated.
                </div>
              )}

              {/* Blocked — shipped/delivered */}
              {(liveStatus === 'SHIPPED' || liveStatus === 'DELIVERED') && liveRefund === 'NONE' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Blocked — order is <strong>{liveStatus}</strong>. Cancel first if needed.
                </p>
              )}

              {/* Initiate button */}
              {isRefundEligible && !refundDone && (
                <button
                  onClick={() => { setShowRefundModal(true); setRefundError(null); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors"
                >
                  <FiRefreshCw size={13} /> Initiate Refund ({formatPrice(order.totalAmount)})
                </button>
              )}
            </section>
          )}

        </div>
      </div>

      {/* ── Status update confirmation alert ── */}
      {pendingStatus && (
        <AlertModal
          type="warning"
          title="Confirm Status Update"
          messages={[
            `Change status from "${ORDER_STATUS_LABELS[liveStatus]}" → "${pendingStatus ? ORDER_STATUS_LABELS[pendingStatus] : ''}".`,
            'This will be recorded in the order timeline and is visible to the customer.',
          ]}
          actionLabel="Yes, Update"
          actionIcon={null}
          onAction={handleStatusConfirm}
          onClose={() => setPendingStatus(null)}
        />
      )}

      {/* ── Refund confirmation modal ── */}
      {showRefundModal && (
        <RefundConfirmModal
          order={order}
          onClose={() => { setShowRefundModal(false); setRefundError(null); }}
          onConfirm={handleRefund}
          loading={refundLoading}
          error={refundError}
        />
      )}
    </div>
  );
}
