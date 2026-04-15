import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setWishlist } from '../store/wishlistSlice';
import { scheduleSyncWishlist } from '../services/syncService';
import { useProducts } from '../hooks/useProducts';
import ProductCard from '../components/ProductCard';
import { FiHeart, FiArrowLeft } from 'react-icons/fi';

export default function WishlistPage() {
  const wishlistIds = useAppSelector((s) => s.wishlist.ids);
  const user        = useAppSelector((s) => s.user.user);
  const dispatch    = useAppDispatch();
  const { products, loading } = useProducts();

  const wishlistProducts = products.filter((p) => wishlistIds.includes(p.id));

  // Prune stale IDs (products that no longer exist in the catalog)
  useEffect(() => {
    if (loading || products.length === 0) return;
    const validIds = wishlistIds.filter((id) => products.some((p) => p.id === id));
    if (validIds.length !== wishlistIds.length) {
      dispatch(setWishlist(validIds));
      scheduleSyncWishlist(validIds, !!(user && !user.isGuest));
    }
  }, [loading, products, wishlistIds, dispatch, user]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="max-w-7xl mx-auto w-full px-4 pt-4 pb-2">

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-dark transition-colors no-underline"
          >
            <FiArrowLeft size={16} />
            Back to shop
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <FiHeart size={22} className="text-rose-500 fill-rose-500" />
          <h1 className="text-2xl font-bold text-gray-900">My Wishlist</h1>
          {wishlistProducts.length > 0 && (
            <span className="ml-1 text-sm font-semibold text-gray-400">
              ({wishlistProducts.length} {wishlistProducts.length === 1 ? 'item' : 'items'})
            </span>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="max-w-7xl mx-auto w-full px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        </div>
      )}

        {/* Empty state */}
        {!loading && wishlistProducts.length === 0 && (
          <div className="flex flex-col items-center pt-8 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <FiHeart size={36} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Your wishlist is empty</h2>
            <p className="text-sm text-gray-400 mb-6 max-w-xs">
              Save items you love by tapping the heart icon on any product.
            </p>
            <Link
              to="/"
              className="px-6 py-2.5 bg-brand-dark text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-colors no-underline"
            >
              Browse Products
            </Link>
          </div>
        )}

        {/* Product grid */}
        {!loading && wishlistProducts.length > 0 && (
          <div className="max-w-7xl mx-auto w-full px-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {wishlistProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
