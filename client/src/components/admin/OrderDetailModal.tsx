import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiLoader, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { ordersApi } from '../../services/apiClient';
import { StoredOrder, OrderStatus } from '../../utils/apiTypes';
import { formatPrice } from '../../utils/format';
import { orderStatusBadge, paymentStatusBadge, fmtDate } from './adminHelpers';

// Statuses an admin can manually set (excludes system-only states)
const ADMIN_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'CONFIRMED',   label: 'Confirmed'   },
  { value: 'PROCESSING',  label: 'Processing'  },
  { value: 'SHIPPED',     label: 'Shipped'     },
  { value: 'DELIVERED',   label: 'Delivered'   },
  { value: 'CANCELLED',   label: 'Cancelled'   },
];

interface Props {
  order: StoredOrder;
  onClose: () => void;
  onStatusUpdated?: (orderId: string, newStatus: OrderStatus) => void;
}

export default function OrderDetailModal({ order, onClose, onStatusUpdated }: Props) {
  const [paymentMethod,  setPaymentMethod]  = useState<string | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(true);
  // Status update state
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(
    ADMIN_STATUSES.find(s => s.value === order.orderStatus)?.value ?? 'CONFIRMED'
  );
  const [updating,      setUpdating]      = useState(false);
  const [updateError,   setUpdateError]   = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  // Local mirror so the badge reflects the latest update without closing
  const [liveStatus,    setLiveStatus]    = useState<OrderStatus>(order.orderStatus);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    ordersApi.track(order.id)
      .then((res) => { if (!cancelled) setPaymentMethod(res.paymentMethod); })
      .catch(() => { /* best-effort */ })
      .finally(() => { if (!cancelled) setLoadingPayment(false); });
    return () => { cancelled = true; };
  }, [order.id]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleUpdateStatus = async () => {
    if (selectedStatus === liveStatus) return;
    setUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    try {
      await ordersApi.updateStatus(order.id, selectedStatus);
      setLiveStatus(selectedStatus);
      setUpdateSuccess(true);
      onStatusUpdated?.(order.id, selectedStatus);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err: any) {
      setUpdateError(err?.message ?? 'Failed to update status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const addr = order.shippingAddress;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <p className="text-xs text-muted font-mono">#{order.id.toUpperCase()}</p>
            <h2 className="text-base font-extrabold text-primary">Order Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${orderStatusBadge(liveStatus)}`}>
              Order: {liveStatus.replace(/_/g, ' ')}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${paymentStatusBadge(order.paymentStatus)}`}>
              Payment: {order.paymentStatus}
            </span>
          </div>

          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Date',     value: fmtDate(order.createdAt) },
              { label: 'Subtotal', value: formatPrice(order.subtotal) },
              { label: 'Tax',      value: formatPrice(order.taxAmount) },
              { label: 'Shipping', value: formatPrice(order.shippingFee) },
              { label: 'Discount', value: order.discount ? `−${formatPrice(order.discount)}` : '—' },
              { label: 'Total',    value: formatPrice(order.totalAmount) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-xs text-muted">{label}</p>
                <p className="font-bold text-sm text-primary">{value}</p>
              </div>
            ))}
          </div>

          {/* Payment method */}
          <div className="bg-indigo-50 rounded-xl px-4 py-3">
            <p className="text-xs text-muted mb-1">Payment Method</p>
            {loadingPayment ? (
              <span className="flex items-center gap-1.5 text-sm text-indigo-500">
                <FiLoader size={13} className="animate-spin" /> Fetching…
              </span>
            ) : (
              <p className="font-bold text-sm text-indigo-700">{paymentMethod || 'N/A'}</p>
            )}
          </div>

          {/* Customer & address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-muted mb-1">Customer Email</p>
              <p className="font-semibold text-sm text-primary break-all">{order.contactEmail || '—'}</p>
            </div>
            {addr && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs text-muted mb-1">Shipping Address</p>
                <p className="font-semibold text-sm text-primary">{addr.name}</p>
                <p className="text-xs text-muted">{[addr.line1, addr.line2].filter(Boolean).join(', ')}</p>
                <p className="text-xs text-muted">{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-wide mb-2">
              Items ({order.items.length})
            </p>
            <div className="flex flex-col gap-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <div>
                    <p className="font-semibold text-sm text-primary">{item.title}</p>
                    <p className="text-xs text-muted">
                      Qty: {item.qty}{item.size ? ` · Size: ${item.size}` : ''} · {formatPrice(item.unitPrice)} each
                    </p>
                  </div>
                  <span className="font-extrabold text-sm text-accent shrink-0">{formatPrice(item.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Update Order Status */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 px-5 py-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Update Order Status</p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <select
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value as OrderStatus); setUpdateError(null); setUpdateSuccess(false); }}
                disabled={updating}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-100 transition-all disabled:opacity-60"
              >
                {ADMIN_STATUSES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                onClick={handleUpdateStatus}
                disabled={updating || selectedStatus === liveStatus}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors flex-shrink-0"
              >
                {updating
                  ? <><FiLoader size={13} className="animate-spin" /> Updating…</>
                  : 'Update Status'}
              </button>
            </div>

            {/* Feedback */}
            {updateSuccess && (
              <p className="mt-2.5 flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <FiCheckCircle size={14} /> Status updated to <strong>{liveStatus.replace(/_/g, ' ')}</strong>
              </p>
            )}
            {updateError && (
              <p className="mt-2.5 flex items-center gap-1.5 text-sm text-red-500">
                <FiAlertCircle size={14} /> {updateError}
              </p>
            )}
            {selectedStatus === liveStatus && !updateSuccess && (
              <p className="mt-2 text-xs text-gray-400">Select a different status to update.</p>
            )}
          </div>

          {/* Timeline */}
          {order.timeline && order.timeline.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wide mb-2">Timeline</p>
              <div className="flex flex-col gap-1.5">
                {order.timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-primary">{t.status.replace(/_/g, ' ')}</p>
                      {t.note && <p className="text-xs text-muted">{t.note}</p>}
                      <p className="text-xs text-muted">{fmtDate(t.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
