import React, { useRef, useEffect, useState } from 'react';
import { useDeleteProductMutation, useSearchProductsQuery } from '../store/apiSlice';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { FiShoppingCart, FiTrendingUp, FiGrid, FiSearch } from 'react-icons/fi';
import ProductCard from '../components/ProductCard';
import { useProducts } from '../hooks/useProducts';

const INITIAL_COUNT = 8;
const LOAD_MORE_COUNT = 8;
// 
// Module-level: persists across navigation so the user sees the same
// scroll depth when going back — no extra API call needed either.
let persistedVisibleCount = INITIAL_COUNT;

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div className="h-56 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-4/5" />
        <div className="h-3 bg-gray-200 rounded w-3/5" />
        <div className="h-5 bg-gray-200 rounded w-1/3 mt-2" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { products, loading: productsLoading, error: productsError, refresh } = useProducts();
  // const cartCount = useAppSelector(state => state.cart.items.reduce((acc, i) => acc + i.qty, 0));
  const isAdmin   = useAppSelector((s) => s.user.user?.isAdmin ?? false);
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter'); // 'bestsellers' | null
  const searchQuery = searchParams.get('q') ?? '';

  const isSearching = searchQuery.length > 0;
  const isBestSellers = filter === 'bestsellers' && !isSearching;

  // Search: only fire when there's a query term
  const {
    data: searchResults,
    isLoading: searchLoading,
    isError: searchError,
  } = useSearchProductsQuery(searchQuery, { skip: !isSearching });

  const loading = isSearching ? searchLoading : productsLoading;
  const error = isSearching ? searchError : productsError;

  // Derived list
  const displayProducts = isSearching
    ? (searchResults ?? [])
    : isBestSellers
        ? [...products]
            .filter((p) => (p.salesCount ?? 0) > 0)
            .sort((a, b) => (b.salesCount ?? 0) - (a.salesCount ?? 0))
        : products;

  // Restore scroll-depth from last visit so cached products appear instantly
  const [visibleCount, setVisibleCount] = useState(persistedVisibleCount);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination when filter or search changes
  useEffect(() => {
    persistedVisibleCount = INITIAL_COUNT;
    setVisibleCount(INITIAL_COUNT);
  }, [filter, searchQuery]);

  const [deleteProduct] = useDeleteProductMutation();

  // Infinite-scroll: watch the sentinel div at the bottom of the list
  useEffect(() => {
    if (loading || error) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => {
            const next = Math.min(prev + LOAD_MORE_COUNT, displayProducts.length);
            persistedVisibleCount = next;
            return next;
          });
        }
      },
      { rootMargin: '300px' }, // pre-load before reaching the very bottom
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, error, displayProducts.length]);

  const visibleProducts = displayProducts.slice(0, visibleCount);
  const hasMore = visibleCount < displayProducts.length;

  const handleAdminDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await deleteProduct(id).unwrap();
    } catch {
      /* deletion failed — refresh to sync state */
    }
    persistedVisibleCount = INITIAL_COUNT;
    setVisibleCount(INITIAL_COUNT);
    refresh({ bust: true });
  };

  return (
    <div>
      {/* Products */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        {/* Section heading with filter tabs */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-2">
          {/* Filter tabs — top-right on mobile, right side on desktop */}
          <div className="flex items-center gap-2 justify-end order-1 md:order-2">
            <Link
              to="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors no-underline ${
                !isBestSellers && !isSearching
                  ? 'bg-brand-dark border-brand-dark text-white'
                  : 'border-border text-muted'
              }`}
            >
              <FiGrid size={13} /> All Products
            </Link>
            <Link
              to="/?filter=bestsellers"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors no-underline ${
                isBestSellers
                  ? 'bg-brand-dark border-brand-dark text-white'
                  : 'border-border text-muted'
              }`}
            >
              <FiTrendingUp size={13} /> Best Sellers
            </Link>
          </div>
          {/* Active label — below filters on mobile, left side on desktop */}
          <h2 className="text-2xl font-bold flex items-center gap-2 text-primary font-display order-2 md:order-1">
            {isSearching ? (
              <><FiSearch className="text-brand-dark" size={20} /> Results for &ldquo;{searchQuery}&rdquo;</>
            ) : isBestSellers ? (
              <><FiTrendingUp className="text-brand-dark" size={22} /> Best Sellers</>
            ) : (
              <><FiGrid className="text-brand-dark" size={20} /> All Products</>
            )}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading
            ? Array.from({ length: INITIAL_COUNT }).map((_, i) => <SkeletonCard key={i} />)
            : error
              ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <p className="mb-3">Could not load products. Please check your connection and try again.</p>
                  <button
                    onClick={() => refresh()}
                    className="px-4 py-2 bg-brand-dark hover:bg-brand-hover text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )
              : displayProducts.length === 0
                ? isSearching
                  ? (
                    <div className="col-span-full text-center py-12">
                      <FiSearch size={36} className="mx-auto mb-3 text-border" />
                      <p className="text-gray-400 text-sm">No products found for &ldquo;{searchQuery}&rdquo;</p>
                      <Link to="/" className="inline-block mt-4 text-sm font-semibold no-underline hover:underline text-brand-dark">Browse all products →</Link>
                    </div>
                  )
                  : isBestSellers
                  ? (
                    <div className="col-span-full text-center py-12">
                      <FiTrendingUp size={36} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-400 text-sm">No best sellers yet — check back after orders come in!</p>
                      <Link to="/" className="inline-block mt-4 text-sm font-semibold no-underline hover:underline text-brand-dark">Browse all products →</Link>
                    </div>
                  )
                  : <p className="col-span-full text-center py-12 text-gray-400">No products available yet.</p>
                : visibleProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      isAdmin={isAdmin}
                      onDelete={handleAdminDelete}
                    />
                  ))
          }
        </div>

        {/* Sentinel — triggers loading next batch when scrolled near */}
        {!loading && !error && displayProducts.length > 0 && (
          <div ref={sentinelRef} aria-hidden="true" className="h-4" />
        )}

        {/* Loading-more skeletons */}
        {!loading && !error && hasMore && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
            {Array.from({ length: Math.min(LOAD_MORE_COUNT, displayProducts.length - visibleCount) }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* End of list label */}
        {!loading && !error && !hasMore && displayProducts.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-8">
            {isSearching
              ? `${displayProducts.length} result${displayProducts.length !== 1 ? 's' : ''} for "${searchQuery}"`
              : isBestSellers
                ? `${displayProducts.length} best seller${displayProducts.length !== 1 ? 's' : ''} shown`
                : 'All products loaded'}
          </p>
        )}
      </section>

      {/* Floating cart button */}
      {/* {cartCount > 0 && (
        <Link
          to="/cart"
          title="Go to cart"
          className="fixed bottom-6 right-6 w-14 h-14 bg-brand-dark text-white rounded-full flex items-center justify-center shadow-lg hover:bg-brand-hover hover:scale-110 transition-all z-50 no-underline text-lg font-bold"
        >
          <FiShoppingCart size={20} />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
            {cartCount}
          </span>
        </Link>
      )} */}
    </div>
  );
}
