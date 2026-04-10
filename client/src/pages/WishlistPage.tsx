import React from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { useProducts } from '../hooks/useProducts';
import ProductCard from '../components/ProductCard';
import { FiHeart, FiArrowLeft } from 'react-icons/fi';

export default function WishlistPage() {
  const wishlistIds = useAppSelector((s) => s.wishlist.ids);
  const { products, loading } = useProducts();

  const wishlistProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-500 transition-colors no-underline"
          >
            <FiArrowLeft size={16} />
            Back to shop
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <FiHeart size={22} className="text-rose-500 fill-rose-500" />
          <h1 className="text-2xl font-bold text-gray-900">My Wishlist</h1>
          {wishlistProducts.length > 0 && (
            <span className="ml-1 text-sm font-semibold text-gray-400">
              ({wishlistProducts.length} {wishlistProducts.length === 1 ? 'item' : 'items'})
            </span>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && wishlistProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mb-4">
              <FiHeart size={36} className="text-rose-300" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Your wishlist is empty</h2>
            <p className="text-sm text-gray-400 mb-6 max-w-xs">
              Save items you love by tapping the heart icon on any product.
            </p>
            <Link
              to="/"
              className="px-6 py-2.5 bg-indigo-500 text-white text-sm font-semibold rounded-xl hover:bg-indigo-600 transition-colors no-underline"
            >
              Browse Products
            </Link>
          </div>
        )}

        {/* Product grid */}
        {!loading && wishlistProducts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {wishlistProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
