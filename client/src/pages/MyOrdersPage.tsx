import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiShoppingBag, FiLoader, FiAlertCircle, FiExternalLink,
  FiX, FiCheckCircle, FiRefreshCw,
} from 'react-icons/fi';
import { ordersApi } from '../services/apiClient';
import { StoredOrder } from '../utils/apiTypes';
import { formatPrice } from '../utils/format';
import { orderStatusBadge, paymentStatusBadge, refundStatusBadge, fmtDate } from '../components/admin/adminHelpers';
import { useAppSelector } from '../store/hooks';
import AlertModal from '../components/AlertModal';
import OrdersTab from '../components/admin/OrdersTab';

// Statuses from which a customer is allowed to self-cancel
const USER_CANCELABLE: string[] = ['PENDING', 'PLACED', 'CONFIRMED', 'PROCESSING'];

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const user     = useAppSelector(s => s.user.user);

  // Admin view toggle: 'mine' = user's own orders, 'all' = admin OrdersTab
  const [view, setView] = useState<'mine' | 'all'>('mine');

  // User's own orders
  const [orders,  setOrders]  = useState<StoredOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Cancel confirmation state
  const [cancelTarget, setCancelTarget] = useState<StoredOrder | null>(null);
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelError,  setCancelError]  = useState<string | null>(null);

  // Redirect unauthenticated / guest users
  useEffect(() => {
    if (!user || user.isGuest) {
      navigate('/auth', { replace: true });
    }
  }, [user, navigate]);

  // Load user's own orders when in 'mine' view
  useEffect(() => {
    if (!user || user.isGuest || view !== 'mine') return;
    setLoading(true);
    setError(null);
    ordersApi.mine()
      .then(r => setOrders(r.orders))
      .catch(e => setError(e?.message ?? 'Failed to load orders.'))
      .finally(() => setLoading(false));
  }, [user, view]);

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await ordersApi.updateStatus(cancelTarget.id, 'CANCELLED');
      setOrders(prev => prev.map(o =>
        o.id === cancelTarget.id ? { ...o, orderStatus: 'CANCELLED' } : o
      ));
      setCancelTarget(null);
    } catch (e: any) {
      setCancelError(e?.message ?? 'Failed to cancel order.');
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  const handleRefresh = () => {
    if (view !== 'mine') return;
    setLoading(true);
    setError(null);
    ordersApi.mine()
      .then(r => setOrders(r.orders))
      .catch(e => setError(e?.message ?? 'Failed to load orders.'))
      .finally(() => setLoading(false));
  };

  const canCancel = (o: StoredOrder) =>
    USER_CANCELABLE.includes(o.orderStatus) && o.paymentStatus !== 'REFUNDED';

  if (!user || user.isGuest) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-primary">
            {view === 'all' ? 'Manage All Orders' : 'My Orders'}
          </h1>
          {view === 'mine' && !loading && (
            <p className="text-xs text-muted mt-0.5">
              {orders.length} order{orders.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Admin toggle — only visible to admins */}
        {user.isAdmin && (
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setView('mine')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                view === 'mine'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              My Orders
            </button>
            <button
              onClick={() => setView('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                view === 'all'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Manage All Orders
            </button>
          </div>
        )}
      </div>

      {/* ── Admin: full OrdersTab ── */}
      {view === 'all' && user.isAdmin && (
        <OrdersTab />
      )}

      {/* ── User: own orders ── */}
      {view === 'mine' && (
        <>
          {/* Error banner */}
          {(error || cancelError) && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
              <FiAlertCircle size={15} className="shrink-0" />
              {error ?? cancelError}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-24 bg-white rounded-2xl animate-pulse shadow-sm border border-gray-100" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && orders.length === 0 && !error && (
            <div className="text-center py-20 text-muted">
              <FiShoppingBag size={40} className="mx-auto mb-3 opacity-25" />
              <p className="font-semibold text-base mb-2">No orders yet</p>
              <Link
                to="/"
                className="text-sm text-brand-dark font-semibold hover:underline"
              >
                Start shopping →
              </Link>
            </div>
          )}

          {/* Refresh */}
          {!loading && orders.length > 0 && (
            <div className="flex justify-end mb-3">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <FiRefreshCw size={12} /> Refresh
              </button>
            </div>
          )}

          {/* Order cards */}
          <div className="flex flex-col gap-3">
            {orders.map(order => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 transition-shadow hover:shadow-md"
              >
                {/* Top row: ID + date + total */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-mono text-xs text-muted truncate max-w-[220px]" title={order.id}>
                        {order.id}
                      </p>
                      <span className="text-muted/40 text-xs">·</span>
                      <p className="text-xs text-muted">{fmtDate(order.createdAt)}</p>
                    </div>

                    {/* Amount */}
                    <p className="font-extrabold text-accent text-base mb-2">
                      {formatPrice(order.totalAmount)}
                    </p>

                    {/* Status badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${orderStatusBadge(order.orderStatus)}`}>
                        {order.orderStatus.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${paymentStatusBadge(order.paymentStatus)}`}>
                        {order.paymentStatus}
                      </span>
                      {order.refundStatus && order.refundStatus !== 'NONE' && (
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${refundStatusBadge(order.refundStatus)}`}>
                          Refund: {order.refundStatus}
                        </span>
                      )}
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Admin: manage order in full detail page */}
                    {user.isAdmin && (
                      <button
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <FiExternalLink size={12} /> Manage
                      </button>
                    )}

                    {/* Track order */}
                    <button
                      onClick={() => navigate(`/order-success?orderId=${order.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-border text-xs font-semibold text-brand-dark hover:bg-brand transition-colors"
                    >
                      Track
                    </button>

                    {/* Cancel (only when eligible) */}
                    {canCancel(order) && (
                      <button
                        onClick={() => { setCancelTarget(order); setCancelError(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <FiX size={12} /> Cancel
                      </button>
                    )}

                    {/* Cancelled confirmation indicator */}
                    {order.orderStatus === 'CANCELLED' && (
                      <span className="flex items-center gap-1 text-xs text-red-500 font-semibold">
                        <FiX size={12} /> Cancelled
                      </span>
                    )}
                    {order.orderStatus === 'DELIVERED' && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                        <FiCheckCircle size={12} /> Delivered
                      </span>
                    )}
                  </div>
                </div>

                {/* Items preview */}
                <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-1.5">
                  {order.items.slice(0, 4).map((item, i) => (
                    <span
                      key={i}
                      className="text-xs text-muted bg-brand rounded-full px-2.5 py-0.5 border border-brand-border/40"
                    >
                      {item.title} ×{item.qty}
                      {item.size ? ` (${item.size})` : ''}
                    </span>
                  ))}
                  {order.items.length > 4 && (
                    <span className="text-xs text-muted">+{order.items.length - 4} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Cancel confirmation modal ── */}
      {cancelTarget && (
        <AlertModal
          type="warning"
          title="Cancel This Order?"
          messages={[
            `Order ID: ${cancelTarget.id}`,
            `Total paid: ${formatPrice(cancelTarget.totalAmount)}`,
            'Cancellation is permanent and cannot be undone. If you have already paid online, please contact support for a refund.',
          ]}
          actionLabel={cancelling ? 'Cancelling…' : 'Yes, Cancel Order'}
          actionVariant="danger"
          actionIcon={<FiX size={14} />}
          onAction={handleCancelConfirm}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}
