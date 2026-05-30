import React from 'react';
import ProductCard from '../components/ProductCard';
import { useProductsPaged } from '../hooks/useProductsPaged';
import Loader from '../components/Loader';

export default function BestSellersPage() {
  // Fetch up to 50 best-selling products sorted by salesCount
  const { products, loading, error, refresh } = useProductsPaged({ 
    pageSize: 50, 
    sortBy: 'bestsellers' 
  });

  // Show full-page loader on initial load
  if (loading && products.length === 0) {
    return <Loader fullPage label="Loading Best Sellers..." />;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-10 md:pt-10 pb-10 min-h-[calc(100vh-120px)] sm:min-h-[calc(100vh-90px)]">
      {/* <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10"> */}
        <div className='flex items-center justify-center h-20'>
          {/* <p className="text-sm uppercase tracking-[0.35em] text-[#8f7a74]">Most loved styles</p> */}
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold text-primary">Best Sellings</h1>
          {/* <p className="mt-3 text-sm sm:text-base text-[#5f5f5f] max-w-2xl">Shop the pieces customers return to again and again.</p> */}
        </div>
      {/* </div> */}

      {error ? (
        <div className="rounded-3xl border border-[#dadada] bg-white px-6 py-10 text-center">
          <p className="text-lg font-medium text-primary">Unable to load best sellers.</p>
          <p className="text-sm text-[#6b7280] mt-2">Please try again or refresh the page.</p>
          <button
            onClick={() => refresh()}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#1a1a1a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#333333] transition"
          >
            Retry
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-3xl border border-[#dadada] bg-white px-6 py-10 text-center text-[#6b7280]">
          No best-selling products available right now.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
