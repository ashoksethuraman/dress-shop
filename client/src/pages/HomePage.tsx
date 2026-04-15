import React, { useRef, useEffect, useState } from 'react';
import { useDeleteProductMutation, useSearchProductsQuery } from '../store/apiSlice';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { FiTrendingUp, FiGrid, FiSearch } from 'react-icons/fi';
import ProductCard from '../components/ProductCard';
import { useProducts } from '../hooks/useProducts';

const INITIAL_COUNT = 10;
const LOAD_MORE_COUNT = 10;

// Persist scroll depth across navigation
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
  const isAdmin = useAppSelector((s) => s.user.user?.isAdmin ?? false);

  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter');
  const searchQuery = searchParams.get('q') ?? '';

  const isSearching = searchQuery.length > 0;
  const isBestSellers = filter === 'bestsellers' && !isSearching;

  const {
    data: searchResults,
    isLoading: searchLoading,
    isError: searchError,
  } = useSearchProductsQuery(searchQuery, { skip: !isSearching });

  const loading = isSearching ? searchLoading : productsLoading;
  const error = isSearching ? searchError : productsError;

  // Derived products
  const displayProducts = isSearching
    ? (searchResults ?? [])
    : isBestSellers
      ? [...products]
        .filter((p) => (p.salesCount ?? 0) > 0)
        .sort((a, b) => (b.salesCount ?? 0) - (a.salesCount ?? 0))
      : products;

  const [visibleCount, setVisibleCount] = useState(persistedVisibleCount);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination when filter/search changes
  useEffect(() => {
    persistedVisibleCount = INITIAL_COUNT;
    setVisibleCount(INITIAL_COUNT);
  }, [filter, searchQuery]);

  const [deleteProduct] = useDeleteProductMutation();

  // Infinite scroll
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
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, error, displayProducts.length]);

  const visibleProducts = displayProducts.slice(0, visibleCount);
  const hasMore = visibleCount < displayProducts.length;

  function extractStoragePath(url: string): string {
    if (!url) return "";

    const noQuery = url.split("?")[0];
    const decoded = decodeURIComponent(noQuery);

    return decoded; // returns "products/halleycomet_xxx.jpg"
  }

  const handleAdminDelete = async (
    id: string,
    title: string,
    images?: string[],
    sizeChart?: string
  ): Promise<void> => {

    if (!window.confirm(`Delete "${title}"?`)) return;

    // Create a NEW mutable array (spread)
    let allImages: string[] = [...(images ?? [])];

    //  Add size chart only if exists
    if (sizeChart) {
      allImages = [...allImages, sizeChart];
    }

    // Convert download URL → storage path
    const formattedImagePaths = allImages.map((img) =>
      extractStoragePath(img)
    );
    
    try {
      await deleteProduct({
        id,
        images: formattedImagePaths,
      }).unwrap();
    } catch (err) {
      console.error("Delete failed:", err);
    }
    
    persistedVisibleCount = INITIAL_COUNT;
    setVisibleCount(INITIAL_COUNT);
    refresh({ bust: true });
  };

  return (
    <div>
      <section className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-2">
          <div className="flex items-center gap-2 justify-end order-1 md:order-2">
            <Link
              to="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${!isBestSellers && !isSearching
                ? 'bg-brand-dark border-brand-dark text-white'
                : 'border-border text-muted'
                }`}
            >
              <FiGrid size={13} /> All Products
            </Link>

            <Link
              to="/?filter=bestsellers"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${isBestSellers
                ? 'bg-brand-dark border-brand-dark text-white'
                : 'border-border text-muted'
                }`}
            >
              <FiTrendingUp size={13} /> Best Sellers
            </Link>
          </div>

          <h2 className="text-2xl font-bold flex items-center gap-2 text-primary order-2 md:order-1">
            {isSearching ? (
              <>
                <FiSearch size={20} /> Results for “{searchQuery}”
              </>
            ) : isBestSellers ? (
              <>
                <FiTrendingUp size={22} /> Best Sellers
              </>
            ) : (
              <>
                <FiGrid size={20} /> All Products
              </>
            )}
          </h2>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: INITIAL_COUNT }).map((_, i) => <SkeletonCard key={i} />)
          ) : error ? (
            <div className="col-span-full text-center py-12">
              <p className="mb-3">Could not load products.</p>
              <button
                onClick={() => refresh()}
                className="px-4 py-2 bg-brand-dark text-white rounded-lg"
              >
                Retry
              </button>
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400">
              No products found.
            </div>
          ) : (
            visibleProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                isAdmin={isAdmin}
                onDelete={handleAdminDelete}
              />
            ))
          )}
        </div>

        {/* Infinite scroll trigger */}
        {!loading && !error && displayProducts.length > 0 && (
          <div ref={sentinelRef} className="h-4" />
        )}

        {/* Loading more */}
        {!loading && !error && hasMore && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
            {Array.from({
              length: Math.min(LOAD_MORE_COUNT, displayProducts.length - visibleCount),
            }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* End */}
        {!loading && !error && !hasMore && displayProducts.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-8">
            All products loaded
          </p>
        )}
      </section>
    </div>
  );
}