import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useProductsPaged } from '../hooks/useProductsPaged';
import { useDeleteProductMutation } from '../store/apiSlice';
import { useAppSelector } from '../store/hooks';
import Loader from '../components/Loader';

type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

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

  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [deleteProduct] = useDeleteProductMutation();



  const [filters, setFilters] = useState<FilterState>({
    availability: 'all',
    priceRange: { min: 0, max: 10000 },
    searchQuery: '',
    category: 'all',
  });

  // map availability to server-expected values ('available' | 'out_of_stock')
  const availabilityParam = filters.availability === 'all' ? undefined : filters.availability;
  const categoryParam = !filters.category || filters.category === 'all' ? undefined : filters.category;
  const { products, loading, error, fetchNext, hasMore, refresh, removeProduct, lastFetchParams, lastFetchCount } = useProductsPaged({ pageSize: INITIAL_COUNT, q: filters.searchQuery, availability: availabilityParam, category: categoryParam, sortBy });

  // Ensure products is always an array
  const safeProducts = products ?? [];

  const priceRange = useMemo(() => {
    if (safeProducts.length === 0) return { min: 0, max: 10000 };
    const prices = safeProducts.map(p => p.price);
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [safeProducts]);

  useEffect(() => {
    if (safeProducts.length > 0 && filters.priceRange.max === 10000) {
      setFilters(prev => ({ ...prev, priceRange: { min: priceRange.min, max: priceRange.max } }));
    }
  }, [safeProducts, priceRange.min, priceRange.max, filters.priceRange.max]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // when filters/sort change, nothing is persisted — user can refresh to reset pages
  }, [filters, sortBy]);

  useEffect(() => {
    // when server-backed filters or server-side sort change, reload pages from first page
    console.log('ProductsPage: Refreshing due to filter/sort change', {
      searchQuery: filters.searchQuery,
      availability: filters.availability,
      category: filters.category,
      sortBy
    });
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.searchQuery, filters.availability, filters.category, sortBy]);

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
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)));
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.title.localeCompare(b.title);
        case 'name-desc': return b.title.localeCompare(a.title);
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        default: return 0;
      }
    });
    return result;
  }, [safeProducts, filters, sortBy]);

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
  }, [loading, error, fetchNext]);

  const visibleProducts = filteredAndSortedProducts;

  const hasActiveFilters = filters.availability !== 'all' || filters.searchQuery.trim() !== '' ||
    filters.priceRange.min !== priceRange.min || filters.priceRange.max !== priceRange.max || (filters.category && filters.category !== 'all');

  const resetFilters = () => {
    setFilters({ availability: 'all', priceRange: { min: priceRange.min, max: priceRange.max }, searchQuery: '', category: 'all' });
    setSortBy('name-asc');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-18 pb-5 min-h-[calc(100vh-120px)] sm:min-h-[calc(100vh-90px)]">
      <div className="flex items-center justify-center h-14 mb-2">
        <h1 className="text-3xl sm:text-4xl font-semibold text-primary">Collections</h1>
        {/* <div className="flex flex-wrap gap-3">
          <Link to="/best-sellers" className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${isBest ? 'border border-[#1a1a1a] bg-[#1a1a1a] text-white' : 'border border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#f5e9e5]'}`}>
            Best Sellers
          </Link>
          <Link to="/collections" className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${isCollections ? 'border border-[#1a1a1a] bg-[#1a1a1a] text-white' : 'border border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#f5e9e5]'}`}>
            Collections
          </Link>
        </div> */}
      </div>

      {!loading && !error && (
        <div className="mb-6" ref={dropdownRef}>
          {/* <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <select
                value={filters.availability}
                onChange={e => setFilters(prev => ({ ...prev, availability: e.target.value as any }))}
                className={`min-w-[160px] px-4 py-3 border rounded-xl text-sm font-medium transition ${filters.availability !== 'all' ? 'bg-[#f8fbff] border-blue-100 text-blue-700' : 'bg-white border-gray-200 text-gray-700'}`}
              >
                <option value="all">All Products</option>
                <option value="available">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
              <select
                value={filters.category}
                onChange={e => setFilters(prev => ({ ...prev, category: e.target.value as any }))}
                className="min-w-[160px] px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700"
              >
                <option value="all">All Categories</option>
                <option value="women">Women</option>
                <option value="men">Men</option>
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="min-w-[180px] px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
              <div className="hidden sm:block text-sm text-gray-600 text-[#8f7a74]">{filteredAndSortedProducts.length} products</div>

              {hasActiveFilters && (
                <button onClick={resetFilters} className="px-4 py-2.5 text-sm font-medium text-red-600 hover:text-red-700 transition">
                  Reset
                </button>
              )}
            </div>
            <div className="mt-4 sm:hidden text-sm text-gray-600">Showing {visibleProducts.length} of {filteredAndSortedProducts.length} products</div>
          </div> */}
          <div className="text-sm text-gray-600 font-semibold text-[#D9B3AF] text-right">{filteredAndSortedProducts.length} products</div>
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