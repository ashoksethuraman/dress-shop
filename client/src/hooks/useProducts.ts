import { useState, useEffect, useCallback } from 'react';
import { firestoreService, invalidateProductsCache } from '../services/firestoreService';
import { productsApi } from '../services/apiClient';
import { Product } from '../utils/types';

interface UseProductsOptions {
  /**
   * Pass `true` to load ALL products (including out-of-stock) — for admin use only.
   * The Cloud Function always returns the public (filtered) list, so when this is
   * true the hook goes directly to the Firestore SDK.
   */
  includeAll?: boolean;
}

interface UseProductsResult {
  products: Product[];
  loading:  boolean;
  error:    boolean;
  /** Re-fetch the list. Optionally pass `bust: true` to invalidate the cache first. */
  refresh:  (opts?: { bust?: boolean }) => void;
}

/**
 * Shared hook for fetching the product catalogue.
 *
 * Strategy:
 *  • Public mode  → Cloud Function (fast CDN-cached edge), fallback to Firestore SDK.
 *  • Admin mode   → Firestore SDK directly (always fresh, includes all products).
 */
export function useProducts({ includeAll = false }: UseProductsOptions = {}): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const refresh = useCallback(async (opts?: { bust?: boolean }) => {
    setLoading(true);
    setError(false);
    if (opts?.bust) invalidateProductsCache();
    try {
      if (includeAll) {
        // Admin: direct Firestore read — bypasses CF filter & cache
        const list = await firestoreService.getProducts({ includeAll: true });
        setProducts(list);
      } else {
        // Public: try Cloud Function first, fall back to Firestore SDK
        try {
          const { products: list } = await productsApi.list();
          setProducts(list as Product[]);
        } catch {
          const list = await firestoreService.getProducts();
          setProducts(list);
        }
      }
    } catch {
      setError(true);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [includeAll]);

  useEffect(() => { refresh(); }, [refresh]);

  return { products, loading, error, refresh };
}
