import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useProductsPaged } from '../hooks/useProductsPaged';
import { useDeleteProductMutation } from '../store/apiSlice';
import { useAppSelector } from '../store/hooks';
import Loader from '../components/Loader';
import Filter from '../components/Filters/Filter';
import useFilters from '../hooks/useFilters';
import { PRODUCT_TYPE_ITEMS } from '../config/productTypes';

interface FilterState {
  availability: 'all' | 'available' | 'out_of_stock';
  priceRange: { min: number; max: number };
  searchQuery: string;
  category?: 'all' | 'women' | 'men';
}

const INITIAL_COUNT = 10;

function SkeletonCard() {
  return <div className="h-96 rounded-3xl bg-gray-100 animate-pulse" />;
}

export default function ProductsPage() {
  const location = useLocation();
  // const isBest = location.pathname === '/best-sellers';
  // const isCollections = location.pathname === '/collections';
  const isAdmin = useAppSelector((s) => s.user.user?.isAdmin ?? false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [deleteProduct] = useDeleteProductMutation();



  // keep availability and priceRange client-side; centralize category/type/q
  const filterStore = useFilters();
  const { filters: sharedFilters, setFilters: setSharedFilters } = filterStore;
  const [filters, setFilters] = useState<FilterState>({
    availability: 'all',
    priceRange: { min: 0, max: 10000 },
    searchQuery: '',
    category: 'all',
  });

  // map availability to server-expected values ('available' | 'out_of_stock')
  const availabilityParam = filters.availability === 'all' ? undefined : filters.availability;
  const categoryParam = !sharedFilters.category || sharedFilters.category === 'ALL' ? undefined : sharedFilters.category.toLowerCase();
  const typeParam = (() => {
    if (!sharedFilters.type || sharedFilters.type === 'ALL') return undefined;
    // If the shared filter holds the key (e.g. 'PYJAMA' or 'T-SHIRT'), map it to the stored label
    const item = PRODUCT_TYPE_ITEMS.find((it) => it.key === sharedFilters.type);
    if (item) return item.label.toLowerCase();
    // Otherwise assume the filter already contains the label
    return sharedFilters.type.toLowerCase();
  })();
  // Send the `type` param exactly as stored in DB (labels like 'Pyjama Set' or 'T-Shirt')
  const typeParamExact = (() => {
    if (!sharedFilters.type || sharedFilters.type === 'ALL') return undefined;
    const item = PRODUCT_TYPE_ITEMS.find((it) => it.key === sharedFilters.type);
    if (item) return item.label;
    return sharedFilters.type;
  })();

  const { products, loading, error, fetchNext, hasMore, refresh, fetchWithParams, removeProduct, lastFetchParams, lastFetchCount } = useProductsPaged({ pageSize: INITIAL_COUNT, q: sharedFilters.q, availability: availabilityParam, category: categoryParam, type: typeParamExact });

  // Ensure products is always an array
  const safeProducts = products ?? [];

  const priceRange = useMemo(() => {
    if (safeProducts.length === 0) return { min: 0, max: 10000 };
    const prices = safeProducts.map(p => p.price);
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [safeProducts]);

  // NOTE: Do not auto-set `filters.priceRange` from the currently-fetched products.
  // Auto-setting here caused newly-fetched pages containing higher-priced items
  // to be excluded because the price filter was narrowed to the first page's range.
  // Keep the default broad range (0..10000) so pagination returns all items.

  // initial sync from URL query params (so external search/navigation works)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const q = params.get('q') ?? '';
      const category = params.get('category') ? params.get('category')!.toUpperCase() : 'ALL';
      const type = params.get('type') ? params.get('type')!.toUpperCase() : 'ALL';
      setSharedFilters({ q, category, type });
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    // when filters change, nothing is persisted — user can refresh to reset pages
  }, [filters]);

  useEffect(() => {
    // when server-backed filters change, reload pages from first page
    console.log('ProductsPage: Refreshing due to filter change', {
      searchQuery: sharedFilters.q,
      type: sharedFilters.type,
      category: sharedFilters.category,
      availability: filters.availability
    });
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedFilters.q, sharedFilters.type, sharedFilters.category, filters.availability]);

  // Debug log for products state
  useEffect(() => {
    console.log('ProductsPage: Products state updated', {
      productsCount: safeProducts.length,
      loading,
      error,
      hasMore
    });
  }, [safeProducts.length, loading, error, hasMore]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...safeProducts];
    if (filters.availability === 'available') result = result.filter(p => p.stock === 'available');
    else if (filters.availability === 'out_of_stock') result = result.filter(p => p.stock === 'out_of_stock');
    result = result.filter(p => p.price >= filters.priceRange.min && p.price <= filters.priceRange.max);
    if (sharedFilters.q && sharedFilters.q.trim()) {
      const query = sharedFilters.q.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)));
    }
    // Products are already sorted by backend (createdAt desc - newest first)
    return result;
  }, [safeProducts, filters, sharedFilters.q]);

  useEffect(() => {
    if (loading || error) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNext();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, error, fetchNext, filteredAndSortedProducts.length]);

  const visibleProducts = filteredAndSortedProducts;

  const hasActiveFilters = filters.availability !== 'all' || (sharedFilters.q && sharedFilters.q.trim() !== '') ||
    filters.priceRange.min !== priceRange.min || filters.priceRange.max !== priceRange.max || (sharedFilters.category && sharedFilters.category !== 'ALL') || (sharedFilters.type && sharedFilters.type !== 'ALL');

  const resetFilters = () => {
    setFilters({ availability: 'all', priceRange: { min: 0, max: 10000 }, searchQuery: '', category: 'all' });
  };

  function extractStoragePath(url: string): string {
    if (!url) return "";
    const noQuery = url.split("?")[0];
    return decodeURIComponent(noQuery);
  }

  const handleAdminDelete = async (
    id: string,
    title: string,
    images?: string[],
    sizeChart?: string
  ): Promise<void> => {
    if (!window.confirm(`Delete "${title}"?`)) return;

    let allImages: string[] = [...(images ?? [])];
    if (sizeChart) allImages = [...allImages, sizeChart];

    const formattedImagePaths = allImages.map((img) => extractStoragePath(img));

    try {
      await deleteProduct({ id, images: formattedImagePaths }).unwrap();
      // Optimistically remove the product from UI instead of full refresh
      removeProduct(id);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete product. Please try again.");
      // On error, refresh to restore correct state
      refresh();
    }
  };

  // Show full-page loader on initial load
  if (loading && safeProducts.length === 0) {
    return <Loader fullPage label="Loading Collections..." />;
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-18 pb-5 min-h-[calc(100vh-120px)] sm:min-h-[calc(100vh-90px)]">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center justify-center gap-2">

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-primary tracking-tight">
              Collections
            </h1>

            {/* Line Divider */}
            <div className="w-16 h-1 bg-primary rounded-full"></div>

            {/* Product Count */}
            <span className="text-sm sm:text-base text-gray-600 font-medium">
              {filteredAndSortedProducts.length} products
            </span>
          </div>
        </div>

        {!error && (
          <div className="mb-6">
            <div className="mb-4">
              <Filter value={sharedFilters} onChange={(f) => {
                // Update shared filters state
                setSharedFilters(f);
                // Compute params for immediate fetch
                const catParam = !f.category || f.category === 'ALL' ? undefined : f.category.toLowerCase();
                const typeParamImmediate = (() => {
                  if (!f.type || f.type === 'ALL') return undefined;
                  const item = PRODUCT_TYPE_ITEMS.find((it) => it.key === f.type);
                  if (item) return item.label;
                  return f.type;
                })();
                // Fire an immediate fetch with the new params to avoid race with effect
                fetchWithParams({ pageSize: INITIAL_COUNT, q: f.q, availability: availabilityParam, category: catParam, type: typeParamImmediate });
              }} />
            </div>

            <div className="flex items-center justify-between">
              {loading && (
                <div className="ml-4">
                  <Loader size="sm" label="Loading..." />
                </div>
              )}
            </div>
          </div>
        )}

        {error ? (
          <div className="rounded-3xl border border-[#dadada] bg-white px-6 py-10 text-center">
            <p className="text-lg font-medium text-primary">Unable to load products.</p>
            <p className="text-sm text-[#6b7280] mt-2">Please try again or refresh the page.</p>
            <button onClick={() => refresh()} className="mt-6 inline-flex items-center justify-center rounded-full bg-[#1a1a1a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#333333] transition">
              Retry
            </button>
          </div>
        ) : filteredAndSortedProducts.length === 0 ? (
          <div className="rounded-3xl border border-[#dadada] bg-white px-6 py-10 text-center text-[#6b7280]">
            <p className="text-lg font-medium">No products found</p>
            <p className="text-sm mt-2">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isAdmin={isAdmin}
                  onDelete={handleAdminDelete}
                />
              ))}
            </div>

            {!loading && !error && filteredAndSortedProducts.length > 0 && (
              <div ref={sentinelRef} className="h-4" />
            )}

            {!loading && !error && hasMore && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 mt-6">
                {Array.from({ length: INITIAL_COUNT }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {!loading && !error && !hasMore && filteredAndSortedProducts.length > 0 && (
              <p className="text-center text-xs text-gray-400 mt-8">All products loaded</p>
            )}
          </>
        )}
      </div>
      {/* Debug overlay - development only */}
      {/* {process.env.NODE_ENV !== 'production' && (
        <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 9999 }}>
          <div className="bg-white border rounded-lg shadow-md p-3 text-xs font-mono text-gray-700" style={{ minWidth: 260 }}>
            <div className="font-semibold text-sm mb-1">Debug</div>
            <div>Products: <strong>{safeProducts.length}</strong></div>
            <div>Filtered: <strong>{filteredAndSortedProducts.length}</strong></div>
            <div>Loading: <strong>{loading ? 'Yes' : 'No'}</strong></div>
            <div>Error: <strong>{error ? 'Yes' : 'No'}</strong></div>
            <div>Has More: <strong>{hasMore ? 'Yes' : 'No'}</strong></div>
            <div>Last response count: <strong>{lastFetchCount}</strong></div>
            <div className="mt-2">Last params:</div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflow: 'auto' }}>{JSON.stringify(lastFetchParams, null, 2)}</pre>
          </div>
        </div>
      )} */}
    </>
  );
}