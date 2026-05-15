import { useCallback, useEffect, useRef, useState } from 'react';
import { useLazyGetProductsPagedQuery } from '../store/apiSlice';
import type { Product } from '../utils/types';

interface UseProductsPagedOptions {
  includeAll?: boolean;
  pageSize?: number;
  sortBy?: string;
}
export function useProductsPaged({ includeAll = false, pageSize = 10, sortBy, category, availability, q }: UseProductsPagedOptions & { category?: string; availability?: string; q?: string } = {}) {
  const [pages, setPages] = useState<Product[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDocId, setLastDocId] = useState<string | undefined>(undefined);
  const [lastFetchParams, setLastFetchParams] = useState<Record<string, any> | null>(null);
  const [lastFetchCount, setLastFetchCount] = useState<number>(0);

  const fetching = useRef(false);

  const aggregated = pages.flat();

  const [trigger] = useLazyGetProductsPagedQuery();

  // Keep latest params in refs so fetchNext always uses the newest values.
  // Assign current params synchronously on each render so callers that
  // trigger fetch immediately (e.g. refresh() after a filter change)
  // will observe the up-to-date values.
  const paramsRef = useRef<{ includeAll: boolean; q?: string; sortBy?: string; category?: string; availability?: string; pageSize: number }>({ includeAll, q, sortBy, category, availability, pageSize });
  paramsRef.current = { includeAll, q, sortBy, category, availability, pageSize };

  const fetchNext = useCallback(async () => {
    if (fetching.current || !hasMore) return;
    fetching.current = true;
    setLoading(true);
    setError(null);

    try {
      const p = paramsRef.current;
      // debug: record which params are used for this fetch
      setLastFetchParams({ lastDocId, ...p });
      // eslint-disable-next-line no-console
      console.debug('fetchNext params', { lastDocId, ...p });

      const res = await trigger({ includeAll: p.includeAll, limit: p.pageSize, lastDocId, q: p.q, sortBy: p.sortBy, category: p.category, availability: p.availability }).unwrap();
      const newProducts: Product[] = res.products ?? [];

      // record last response count for debug overlay
      setLastFetchCount(res.products?.length ?? 0);

      // avoid duplicates: only append items that are not already present
      setPages((prev) => {
        const existingIds = new Set(prev.flat().map((p) => p.id));
        const filtered = newProducts.filter((p) => !existingIds.has(p.id));
        // append the filtered (may be empty) so pagination markers still advance
        return [...prev, filtered];
      });

      setHasMore(Boolean(res.hasMore));
      setLastDocId(res.lastDocId);
    } catch (err) {
      setError(err);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, [trigger, hasMore, lastDocId]);

  const refresh = useCallback(async () => {
    // clear and fetch first page
    setPages([]);
    setHasMore(true);
    setLastDocId(undefined);
    fetching.current = false;
    setError(null);
    setLoading(false);
    // Trigger fetchNext on next tick to ensure state is updated
    setTimeout(() => {
      fetchNext();
    }, 0);
  }, [fetchNext]);

  const removeProduct = useCallback((productId: string) => {
    // Optimistically remove the product from the current state
    setPages((prev) => {
      return prev.map((page) => page.filter((product) => product.id !== productId));
    });
  }, []);

  // initial load
  useEffect(() => {
    if (pages.length === 0 && !loading && !error) {
      fetchNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    products: aggregated,
    loading,
    error: Boolean(error),
    fetchNext,
    hasMore,
    refresh,
    removeProduct,
    // debug info
    lastFetchParams,
    lastFetchCount,
  };
}

export default useProductsPaged;
