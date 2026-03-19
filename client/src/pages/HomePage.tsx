import React, { useEffect, useState, useCallback } from 'react';
import { firestoreService } from '../services/firestoreService';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { FiShoppingCart } from 'react-icons/fi';
import ProductCard from '../components/ProductCard';

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
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const cartCount = useAppSelector(state => state.cart.items.length);
  const isAdmin = useAppSelector((s) => s.user.user?.isAdmin ?? false);

  const loadProducts = useCallback(async () => {
    const p = await firestoreService.getProducts();
    setProducts(p);
    setLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleAdminDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    await firestoreService.deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-400 text-white px-6 py-16 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
        <h1 className="relative text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">Welcome to Dress Shop</h1>
        <p className="relative text-lg sm:text-xl font-light opacity-90">Discover premium dresses for every occasion</p>
        <Link to="/cart"
          className="relative inline-block mt-6 px-8 py-3 bg-white text-indigo-600 font-bold rounded-full shadow-lg hover:scale-105 transition-transform no-underline text-sm">
          Shop Now
        </Link>
      </section>

      {/* Products */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-primary mb-6">Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  isAdmin={isAdmin}
                  onDelete={handleAdminDelete}
                />
              ))
          }
        </div>
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
