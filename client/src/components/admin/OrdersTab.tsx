import React, { useState, useEffect, useCallback } from 'react';
import { FiRefreshCw, FiShoppingBag, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
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

/** Per-page cache: pageNumber → rows */
type PageCache    = Record<number, StoredOrder[]>;
/** Cursor cache: pageNumber → lastDocId of that page (used to fetch page+1) */
type CursorCache  = Record<number, string>;
/** Whether each fetched page has a next page available */
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

  /**
   * Fetch a specific page from the server.
   * - cursor: lastDocId of the previous page (undefined for page 1)
   * - Stores results in pagesCache, cursorsCache, hasMoreCache
   * Returns true on success, false on error.
   */
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
        ...(cursor                      ? { lastDocId: cursor }          : {}),
        ...(filter && filter !== 'all'  ? { status: filter }             : {}),
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

  /** Reset all cache and refetch page 1 whenever the filter changes */
  useEffect(() => {
    setPagesCache({});
    setCursorsCache({});
    setHasMoreCache({});
    setCurrentPage(1);
    fetchPage(1, undefined, statusFilter);
  }, [statusFilter, fetchPage]);

  const handleNext = async () => {
    const next = currentPage + 1;
    // Use cached page if already fetched, otherwise fetch from server
    if (!pagesCache[next]) {
      const ok = await fetchPage(next, cursorsCache[currentPage], statusFilter);
      if (!ok) return;
    }
    setCurrentPage(next);
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  const handleRefresh = () => {
    setPagesCache({});
    setCursorsCache({});
    setHasMoreCache({});
    setCurrentPage(1);
    fetchPage(1, undefined, statusFilter);
  };

  const orders   = pagesCache[currentPage] ?? [];
  const fetched  = Boolean(pagesCache[currentPage]);
  // Can go next if the next page is already cached OR the server said there are more
  const canNext  = Boolean(pagesCache[currentPage + 1]) || Boolean(hasMoreCache[currentPage]);
  const canPrev  = currentPage > 1;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${statusFilter === value
                  ? 'bg-indigo-600 text-white shadow-sm'
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

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
          {error}
        </div>
      )}

      {/* Loading skeleton — only on first load of a page */}
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
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Order ID', 'Customer', 'Date', 'Items', 'Total', 'Order Status', 'Payment'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[180px] truncate" title={order.id}>
                    {order.id}
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    {order.billingAddress?.name && (
                      <p className="text-primary font-semibold text-xs truncate">{order.billingAddress.name}</p>
                    )}
                    <p className="text-muted text-xs truncate">{order.contactEmail || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDate(order.createdAt)}</td>
                  <td className="px-4 py-3 text-center text-muted">{order.items.length}</td>
                  <td className="px-4 py-3 font-bold text-accent whitespace-nowrap">
                    {formatPrice(order.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${orderStatusBadge(order.orderStatus)}`}>
                      {order.orderStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
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
            {loading && <span className="ml-2 text-indigo-500">Loading…</span>}
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
            // Optimistically update the row in every cached page
            setPagesCache(prev => {
              const next = { ...prev };
              for (const page of Object.keys(next)) {
                next[+page] = next[+page].map(o =>
                  o.id === orderId ? { ...o, orderStatus: newStatus } : o
                );
              }
              return next;
            });
            // Also update the open modal's order reference
            setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, orderStatus: newStatus } : prev);
          }}
        />
      )}
    </div>
  );
}
