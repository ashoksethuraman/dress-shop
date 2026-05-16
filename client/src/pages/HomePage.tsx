import React from 'react';
import ProductCard from '../components/ProductCard';
import { useProducts } from '../hooks/useProducts';
import { useDeleteProductMutation, useSearchProductsQuery } from '../store/apiSlice';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { FiTrendingUp, FiGrid, FiSearch } from 'react-icons/fi';

function ProductPlaceholder() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div className="h-64 bg-gray-200" />
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
  const isAdmin = useAppSelector((s) => s.user.user?.isAdmin ?? false);

  const allProducts = products ?? [];
  const bestSellers = [...allProducts]
    .filter((product) => (product.salesCount ?? 0) > 0)
    .sort((a, b) => (b.salesCount ?? 0) - (a.salesCount ?? 0));

  const heroImage = '/assets/home-page-banner-image.jpg';

  const featuredBestSellers = bestSellers.length > 0 ? bestSellers.slice(0, 4) : allProducts.slice(0, 4);
  const featuredProducts = allProducts.slice(0, 4);

  const announceItems = [
    'Limited Stock Available',
    'Loved by 1000+ Women',
    'Free Shipping on all orders',
    '10% Off on your first order',
    'PAN India Shipping',
  ];

  return (
    <div className="text-primary overflow-x-hidden">
      <section className="relative overflow-hidden bg-[#D9B3AF] text-[#1a1a1a] min-h-[calc(57vh-90px)] -mx-6 sm:-mx-8 lg:-mx-12">
        <div className="max-w-6xl mx-auto w-full h-full flex items-center py-6 sm:py-8 px-6 sm:px-8 lg:px-12">
          <div className="grid gap-6 lg:gap-10 lg:grid-cols-[1.3fr_0.7fr] items-center w-full">
            <div className="text-center lg:text-left order-2 lg:order-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">Wear comfort. Own your style.</h1>
              <p className="mt-5 max-w-xl text-base sm:text-lg leading-7 text-[#333333]">
                From cozy loungewear to everyday tees, find pieces designed for comfort, style, and everything in between. Made to move with you at home and beyond.
              </p>
              <div className="mt-6 sm:mt-8  flex flex-col gap-3 sm:gap-4 items-center md:items-start">
                <Link
                  to="/products"
                  className="inline-flex items-center justify-center !rounded-md bg-[#1a1a1a] px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#333333] w-64 sm:w-auto"
                >
                  Explore Now
                </Link>
              </div>
            </div>
            <div
              className="overflow-hidden border border-black/10 shadow-2xl bg-white w-full max-w-[360px] mx-auto lg:ml-auto lg:mr-0 order-1 lg:order-2"
              style={{ borderRadius: '130px 30px', height: '460px' }}
            >
              {heroImage ? (
                <img
                  src={heroImage}
                  alt="Hero product"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#efe1dc]" />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#1a1a1a] border-t border-black/10 py-3 -mx-6 sm:-mx-8 lg:-mx-12">
        <div className="max-w-full px-6 sm:px-8 lg:px-12 overflow-hidden">
          <div className="flex whitespace-nowrap animate-marquee gap-8 text-xs sm:text-sm font-semibold tracking-wide text-white/90">
            {announceItems.concat(announceItems).map((item, index) => (
              <span key={`${item}-${index}`} className="inline-flex items-center gap-3 shrink-0">
                <span className="text-nowrap">{item}</span>
                <span className="text-white/40">|</span>
              </span>
            ))}
          </div>
        </div>
      </section>
      {/* 
      <section className="max-w-6xl mx-auto py-16">
        <div className="text-center mb-10">
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold">Best Selling</h2>
          <p className="mt-3 text-sm sm:text-base text-[#5f5f5f] max-w-2xl mx-auto">
            Elevate your comfort with our curated selection of best-selling styles.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <ProductPlaceholder key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[30px] border border-black/10 bg-white px-6 py-16 text-center shadow-sm">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Unable to Load Products</h3>
            <p className="text-sm text-gray-500 mb-6">We couldn't load the product list. Please try again.</p>
            <button
              onClick={() => refresh()}
              className="inline-flex items-center justify-center rounded-none bg-[#1a1a1a] px-8 py-3 text-sm font-semibold text-white hover:bg-[#333333] transition w-64 sm:w-auto"
            >
              Retry
            </button>
          </div>
        ) : featuredBestSellers.length === 0 ? (
          <div className="rounded-[30px] border border-black/10 bg-white px-6 py-16 text-center shadow-sm">
            <div className="w-20 h-20 rounded-full bg-[#f0e8e4] flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[#8e6c69]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">No Best Sellers Yet</h3>
            <p className="text-sm text-gray-500 mb-6">Check back soon for our most popular items!</p>
            <Link
              to="/products"
              className="inline-flex items-center justify-center rounded-none border border-[#1a1a1a] bg-white px-6 py-3 text-sm font-semibold text-[#1a1a1a] transition hover:bg-[#f7ece8] w-64 sm:w-auto"
            >
              Browse All Products
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredBestSellers.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="flex justify-center mt-8">
              <Link
                to="/best-sellers"
                className="inline-flex items-center justify-center rounded-none border border-[#1a1a1a] bg-white px-8 py-3 text-sm font-semibold text-[#1a1a1a] transition hover:bg-[#f7ece8] w-64 sm:w-auto"
              >
                View All Best Sellers
              </Link>
            </div>
          </>
        )}
      </section> */}

      <section className="bg-white py-16 -mx-6 sm:-mx-8 lg:-mx-12">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-10">
            {/* <p className="text-sm uppercase tracking-[0.25em] text-[#8e6c69]">Featured collection</p> */}
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold">Our Products</h2>
            <p className="mt-3 text-sm sm:text-base text-[#5f5f5f] max-w-2xl mx-auto">
              Explore a broader range of styles and everyday essentials from our dress shop.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <ProductPlaceholder key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-[30px] border border-black/10 bg-white px-6 py-16 text-center shadow-sm">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Unable to Load Products</h3>
              <p className="text-sm text-gray-500 mb-6">We couldn't load the product list. Please try again.</p>
              <button
                onClick={() => refresh()}
                className="inline-flex items-center justify-center rounded-none bg-[#1a1a1a] px-8 py-3 text-sm font-semibold text-white hover:bg-[#333333] transition w-64 sm:w-auto"
              >
                Retry
              </button>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="rounded-[30px] border border-black/10 bg-white px-6 py-16 text-center shadow-sm">
              <div className="w-20 h-20 rounded-full bg-[#f0e8e4] flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-[#8e6c69]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">No Products Available</h3>
              <p className="text-sm text-gray-500">Check back soon for new arrivals!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <div className="flex justify-center mt-8">
                <Link
                  to="/collections"
                  className="inline-flex items-center justify-center rounded-md border border-[#1a1a1a] bg-white px-8 py-3 text-sm font-semibold text-[#1a1a1a] transition hover:bg-[#1a1a1a] hover:text-white w-64 sm:w-auto"
                >
                  View All Products
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

    </div>
  );
}
