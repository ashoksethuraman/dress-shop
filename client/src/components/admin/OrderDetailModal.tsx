import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiLoader, FiCheckCircle, FiAlertCircle, FiMapPin, FiMail, FiPackage, FiClock } from 'react-icons/fi';
import { ordersApi } from '../../services/apiClient'; // backend
// import { firestoreOrdersApi as ordersApi } from '../../services/firestoreClient'; // direct firestore
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
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(
    ADMIN_STATUSES.find(s => s.value === order.orderStatus)?.value ?? 'CONFIRMED'
  );
  const [updating,      setUpdating]      = useState(false);
  const [updateError,   setUpdateError]   = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [liveStatus,    setLiveStatus]    = useState<OrderStatus>(order.orderStatus);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    ordersApi.track(order.id)
      .then((res) => { if (!cancelled) setPaymentMethod(res.paymentMethod); })
      .catch(() => {})
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
      className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-10 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

        {/* ── Branded header ── */}
        <div className="bg-brand border-b border-brand-border px-6 py-4 sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-brand-border/70 uppercase tracking-widest mb-0.5">Order Details</p>
              <p className="font-mono text-xs text-primary/60 truncate">{order.id}</p>
              {/* Status badges right at the top */}
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${orderStatusBadge(liveStatus)}`}>
                  Order: {liveStatus.replace(/_/g, ' ')}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${paymentStatusBadge(order.paymentStatus)}`}>
                  Payment: {order.paymentStatus}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-brand-border hover:bg-brand-border/20 transition-all flex-shrink-0 mt-0.5"
            >
              <FiX size={18} />
            </button>
          </div>

          {/* ── Status Update — inline in header area ── */}
          <div className="mt-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value as OrderStatus); setUpdateError(null); setUpdateSuccess(false); }}
              disabled={updating}
              className="flex-1 border border-brand-border rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:border-brand-dark focus:ring-brand transition-all disabled:opacity-60"
            >
              {ADMIN_STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              onClick={handleUpdateStatus}
              disabled={updating || selectedStatus === liveStatus}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-dark hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors flex-shrink-0 whitespace-nowrap"
            >
              {updating
                ? <><FiLoader size={13} className="animate-spin" /> Updating…</>
                : 'Update Status'}
            </button>
          </div>
          {updateSuccess && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-border font-semibold">
              <FiCheckCircle size={13} /> Updated to <strong>{liveStatus.replace(/_/g, ' ')}</strong>
            </p>
          )}
          {updateError && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
              <FiAlertCircle size={13} /> {updateError}
            </p>
          )}
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Summary grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Date',     value: fmtDate(order.createdAt) },
              { label: 'Subtotal', value: formatPrice(order.subtotal) },
              { label: 'Tax',      value: formatPrice(order.taxAmount) },
              { label: 'Shipping', value: formatPrice(order.shippingFee) },
              { label: 'Discount', value: order.discount ? `−${formatPrice(order.discount)}` : '—' },
              { label: 'Total',    value: formatPrice(order.totalAmount) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-brand rounded-xl border border-brand-border/40 px-3 py-2.5">
                <p className="text-[10px] font-bold text-brand-border/80 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="font-bold text-sm text-primary">{value}</p>
              </div>
            ))}
          </div>

          {/* Customer + address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-brand rounded-xl border border-brand-border/40 px-4 py-3 flex gap-3">
              <FiMail size={15} className="text-brand-border mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-brand-border/80 uppercase tracking-wider mb-0.5">Customer</p>
                <p className="font-semibold text-sm text-primary break-all">{order.contactEmail || '—'}</p>
                {loadingPayment
                  ? <p className="text-xs text-muted mt-0.5 flex items-center gap-1"><FiLoader size={11} className="animate-spin" /> Method…</p>
                  : <p className="text-xs text-muted mt-0.5">Method: {paymentMethod || 'N/A'}</p>
                }
              </div>
            </div>
            {addr && (
              <div className="bg-brand rounded-xl border border-brand-border/40 px-4 py-3 flex gap-3">
                <FiMapPin size={15} className="text-brand-border mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-brand-border/80 uppercase tracking-wider mb-0.5">Ship To</p>
                  <p className="font-semibold text-sm text-primary">{addr.name}</p>
                  <p className="text-xs text-muted">{[addr.line1, addr.line2].filter(Boolean).join(', ')}</p>
                  <p className="text-xs text-muted">{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted uppercase tracking-wide mb-2">
              <FiPackage size={13} /> Items ({order.items.length})
            </p>
            <div className="flex flex-col gap-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-brand rounded-xl border border-brand-border/40 px-4 py-3">
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

          {/* Timeline */}
          {order.timeline && order.timeline.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted uppercase tracking-wide mb-2">
                <FiClock size={13} /> Timeline
              </p>
              <div className="flex flex-col gap-1.5 border-l-2 border-brand-border ml-2 pl-4">
                {order.timeline.map((t, i) => (
                  <div key={i} className="relative">
                    <span className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-brand-border border-2 border-white top-1" />
                    <p className="text-xs font-semibold text-primary">{t.status.replace(/_/g, ' ')}</p>
                    {t.note && <p className="text-xs text-muted">{t.note}</p>}
                    <p className="text-xs text-muted">{fmtDate(t.timestamp)}</p>
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

