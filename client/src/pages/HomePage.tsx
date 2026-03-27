import React, { useRef, useEffect, useState } from 'react';
import { useDeleteProductMutation } from '../store/apiSlice';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { FiShoppingCart } from 'react-icons/fi';
import ProductCard from '../components/ProductCard';
import { useProducts } from '../hooks/useProducts';

const INITIAL_COUNT = 8;
const LOAD_MORE_COUNT = 8;

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
  const { products, loading, error, refresh } = useProducts();
  const cartCount = useAppSelector(state => state.cart.items.reduce((acc, i) => acc + i.qty, 0));
  const isAdmin   = useAppSelector((s) => s.user.user?.isAdmin ?? false);

  // Restore scroll-depth from last visit so cached products appear instantly
  const [visibleCount, setVisibleCount] = useState(persistedVisibleCount);
  const sentinelRef = useRef<HTMLDivElement>(null);

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
            const next = Math.min(prev + LOAD_MORE_COUNT, products.length);
            persistedVisibleCount = next;
            return next;
          });
        }
      },
      { rootMargin: '300px' }, // pre-load before reaching the very bottom
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, error, products.length]);

  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

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
    <div className="min-h-screen">
      {/* Hero — compact height */}
      <section className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-400 text-white px-6 py-5 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
        <h1 className="relative text-xl sm:text-2xl font-extrabold tracking-tight mb-1">Welcome to Dress Shop</h1>
        <p className="relative text-xs sm:text-sm font-light opacity-90">Discover premium dresses for every occasion</p>
        <Link
          to="/cart"
          className="relative inline-block mt-3 px-5 py-1.5 bg-white text-indigo-600 font-bold rounded-full shadow-lg hover:scale-105 transition-transform no-underline text-xs"
        >
          Shop Now
        </Link>
      </section>

      {/* Products */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-primary mb-6">Products</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading
            ? Array.from({ length: INITIAL_COUNT }).map((_, i) => <SkeletonCard key={i} />)
            : error
              ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <p className="mb-3">Could not load products. Please check your connection and try again.</p>
                  <button
                    onClick={() => refresh()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )
              : products.length === 0
                ? <p className="col-span-full text-center py-12 text-gray-400">No products available yet.</p>
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
        {!loading && !error && products.length > 0 && (
          <div ref={sentinelRef} aria-hidden="true" className="h-4" />
        )}

        {/* Loading-more skeletons */}
        {!loading && !error && hasMore && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
            {Array.from({ length: Math.min(LOAD_MORE_COUNT, products.length - visibleCount) }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* End of list label */}
        {!loading && !error && !hasMore && products.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-8">All products loaded</p>
        )}
      </section>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <Link
          to="/cart"
          title="Go to cart"
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-600 hover:scale-110 transition-all z-50 no-underline text-lg font-bold"
        >
          <FiShoppingCart size={20} />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
            {cartCount}
          </span>
        </Link>
      )}
    </div>
  );
}
