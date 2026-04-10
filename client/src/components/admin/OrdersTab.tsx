import React, { useState, useEffect, useCallback } from 'react';
import { FiRefreshCw, FiShoppingBag, FiChevronLeft, FiChevronRight, FiLoader, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { ordersApi } from '../../services/apiClient'; // backend
// import { firestoreOrdersApi as ordersApi } from '../../services/firestoreClient'; // direct firestore
import { StoredOrder, OrderStatus } from '../../utils/apiTypes';
import { formatPrice } from '../../utils/format';
import { PAGE_SIZE, orderStatusBadge, paymentStatusBadge, fmtDate } from './adminHelpers';
import OrderDetailModal from './OrderDetailModal';

const STATUS_OPTIONS = [
  { value: 'all',            label: 'All' },
  { value: 'PENDING',        label: 'Pending' },
  { value: 'PLACED',         label: 'Placed' },
  { value: 'CONFIRMED',      label: 'Confirmed' },
  { value: 'PROCESSING',     label: 'Processing' },
  { value: 'SHIPPED',        label: 'Shipped' },
  { value: 'DELIVERED',      label: 'Delivered' },
  { value: 'CANCELLED',      label: 'Cancelled' },
  { value: 'PAYMENT_FAILED', label: 'Pay Failed' },
];

const BULK_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'CONFIRMED',  label: 'Confirmed'  },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED',    label: 'Shipped'    },
  { value: 'DELIVERED',  label: 'Delivered'  },
  { value: 'CANCELLED',  label: 'Cancelled'  },
];

type PageCache    = Record<number, StoredOrder[]>;
type CursorCache  = Record<number, string>;
type HasMoreCache = Record<number, boolean>;

export default function OrdersTab() {
  const [pagesCache,    setPagesCache]    = useState<PageCache>({});
  const [cursorsCache,  setCursorsCache]  = useState<CursorCache>({});
  const [hasMoreCache,  setHasMoreCache]  = useState<HasMoreCache>({});
  const [currentPage,   setCurrentPage]   = useState(1);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<StoredOrder | null>(null);

  // Bulk selection state
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [bulkStatus,    setBulkStatus]    = useState<OrderStatus>('CONFIRMED');
  const [bulkUpdating,  setBulkUpdating]  = useState(false);
  const [bulkSuccess,   setBulkSuccess]   = useState(false);
  const [bulkError,     setBulkError]     = useState<string | null>(null);

  const fetchPage = useCallback(async (
    page: number,
    cursor: string | undefined,
    filter: string,
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await ordersApi.all({
        limit:     PAGE_SIZE,
        ...(cursor                      ? { lastDocId: cursor } : {}),
        ...(filter && filter !== 'all'  ? { status: filter }   : {}),
      });
      const lastId = res.orders[res.orders.length - 1]?.id;
      setPagesCache(prev    => ({ ...prev, [page]: res.orders }));
      if (lastId) setCursorsCache(prev => ({ ...prev, [page]: lastId }));
      setHasMoreCache(prev  => ({ ...prev, [page]: res.hasMore }));
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to load orders');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPagesCache({});
    setCursorsCache({});
    setHasMoreCache({});
    setCurrentPage(1);
    setSelectedIds(new Set());
    fetchPage(1, undefined, statusFilter);
  }, [statusFilter, fetchPage]);

  const handleNext = async () => {
    const next = currentPage + 1;
    if (!pagesCache[next]) {
      const ok = await fetchPage(next, cursorsCache[currentPage], statusFilter);
      if (!ok) return;
    }
    setCurrentPage(next);
    setSelectedIds(new Set());
  };

  const handlePrev = () => {
    if (currentPage > 1) { setCurrentPage(p => p - 1); setSelectedIds(new Set()); }
  };

  const handleRefresh = () => {
    setPagesCache({});
    setCursorsCache({});
    setHasMoreCache({});
    setCurrentPage(1);
    setSelectedIds(new Set());
    fetchPage(1, undefined, statusFilter);
  };

  const orders  = pagesCache[currentPage] ?? [];
  const fetched = Boolean(pagesCache[currentPage]);
  const canNext = Boolean(pagesCache[currentPage + 1]) || Boolean(hasMoreCache[currentPage]);
  const canPrev = currentPage > 1;

  // Checkbox helpers
  const allSelected = orders.length > 0 && orders.every(o => selectedIds.has(o.id));
  const someSelected = orders.some(o => selectedIds.has(o.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const next = new Set(prev); orders.forEach(o => next.delete(o.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); orders.forEach(o => next.add(o.id)); return next; });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    setBulkError(null);
    setBulkSuccess(false);
    try {
      await Promise.all(Array.from(selectedIds).map(id => ordersApi.updateStatus(id, bulkStatus)));
      // Update cache
      setPagesCache(prev => {
        const next = { ...prev };
        for (const page of Object.keys(next)) {
          next[+page] = next[+page].map(o =>
            selectedIds.has(o.id) ? { ...o, orderStatus: bulkStatus } : o
          );
        }
        return next;
      });
      setBulkSuccess(true);
      setSelectedIds(new Set());
      setTimeout(() => setBulkSuccess(false), 3000);
    } catch (err: any) {
      setBulkError(err?.message ?? 'Bulk update failed.');
    } finally {
      setBulkUpdating(false);
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${statusFilter === value
                  ? 'bg-brand-dark text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 mb-3 px-4 py-3 bg-brand border border-brand-border rounded-2xl">
          <span className="text-sm font-semibold text-primary">
            {selectedIds.size} selected
          </span>
          <div className="flex-1 flex flex-wrap items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
              disabled={bulkUpdating}
              className="border border-brand-border rounded-xl px-3 py-1.5 text-sm bg-white text-primary focus:outline-none focus:ring-2 focus:ring-brand transition-all disabled:opacity-60"
            >
              {BULK_STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              onClick={handleBulkUpdate}
              disabled={bulkUpdating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand-dark hover:bg-brand-hover disabled:opacity-50 text-white font-bold text-sm transition-colors"
            >
              {bulkUpdating ? <><FiLoader size={13} className="animate-spin" /> Updating…</> : 'Update Status'}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-xl border border-gray-300 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          </div>
          {bulkSuccess && (
            <p className="text-xs text-brand-border font-semibold flex items-center gap-1">
              <FiCheckCircle size={13} /> Updated successfully
            </p>
          )}
          {bulkError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <FiAlertCircle size={13} /> {bulkError}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !fetched && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: PAGE_SIZE }, (_, i) => (
            <div key={i} className="h-12 bg-white rounded-xl animate-pulse shadow-sm" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && fetched && orders.length === 0 && (
        <div className="text-center py-16 text-muted">
          <FiShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
          <p>No orders found.</p>
        </div>
      )}

      {/* Table */}
      {fetched && orders.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-brand border-b border-brand-border">
              <tr>
                {/* Select-all checkbox */}
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-brand-dark rounded cursor-pointer"
                  />
                </th>
                {['Order ID', 'Customer', 'Date', 'Items', 'Total', 'Order Status', 'Payment'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-brand-border uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={`border-b border-gray-50 last:border-0 transition-colors ${
                    selectedIds.has(order.id) ? 'bg-brand/60' : 'hover:bg-brand/30'
                  }`}
                >
                  {/* Checkbox cell — stops row click propagation */}
                  <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(order.id)}
                      onChange={() => toggleOne(order.id)}
                      className="w-4 h-4 accent-brand-dark rounded cursor-pointer"
                    />
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[180px] truncate cursor-pointer"
                    title={order.id}
                    onClick={() => setSelectedOrder(order)}
                  >
                    {order.id}
                  </td>
                  <td className="px-4 py-3 max-w-[180px] cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    {order.billingAddress?.name && (
                      <p className="text-primary font-semibold text-xs truncate">{order.billingAddress.name}</p>
                    )}
                    <p className="text-muted text-xs truncate">{order.contactEmail || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap cursor-pointer" onClick={() => setSelectedOrder(order)}>{fmtDate(order.createdAt)}</td>
                  <td className="px-4 py-3 text-center text-muted cursor-pointer" onClick={() => setSelectedOrder(order)}>{order.items.length}</td>
                  <td className="px-4 py-3 font-bold text-accent whitespace-nowrap cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    {formatPrice(order.totalAmount)}
                  </td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${orderStatusBadge(order.orderStatus)}`}>
                      {order.orderStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${paymentStatusBadge(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {fetched && (canPrev || canNext) && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted">
            Page {currentPage} &middot; {orders.length} order{orders.length !== 1 ? 's' : ''}
            {loading && <span className="ml-2 text-brand-dark">Loading…</span>}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handlePrev}
              disabled={!canPrev || loading}
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-all"
            >
              <FiChevronLeft size={15} />
            </button>
            <button
              onClick={handleNext}
              disabled={!canNext || loading}
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-all"
            >
              <FiChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusUpdated={(orderId, newStatus: OrderStatus) => {
            setPagesCache(prev => {
              const next = { ...prev };
              for (const page of Object.keys(next)) {
                next[+page] = next[+page].map(o =>
                  o.id === orderId ? { ...o, orderStatus: newStatus } : o
                );
              }
              return next;
            });
            setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, orderStatus: newStatus } : prev);
          }}
        />
      )}
    </div>
  );
}