import React, { useEffect, useState, useCallback } from 'react';
import { firestoreService } from '../services/firestoreService';
import { Product } from '../utils/types';
import AdminProductForm from '../components/AdminProductForm';
import { FiPackage, FiTrash2, FiRefreshCw } from 'react-icons/fi';

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'men' | 'women'>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await firestoreService.getProducts();
    setProducts(all);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const del = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    setDeleting(id);
    await firestoreService.deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
  };

  const visible = filter === 'all' ? products : products.filter((p) => p.category === filter);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <FiPackage size={20} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-primary leading-tight">Product Manager</h1>
            <p className="text-xs text-muted">Admin — manage your catalogue</p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Add Product Form */}
      <AdminProductForm onAdded={refresh} />

      {/* Product list */}
      <div className="mt-10">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-base font-bold text-primary">
            All Products
            <span className="ml-2 text-sm font-medium text-muted">({visible.length})</span>
          </h3>
          {/* Filter tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['all', 'women', 'men'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize
                  ${filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {f === 'all' ? 'All' : f === 'women' ? '👗 Women' : '👔 Men'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white rounded-2xl animate-pulse shadow-sm" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <FiPackage size={32} className="mx-auto mb-3 opacity-30" />
            <p>No products yet. Add one above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((p) => {
              const thumb = p.images?.[0] || p.image;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 bg-white rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {thumb
                      ? <img src={thumb} alt={p.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">👗</div>
                    }
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-primary truncate">{p.title}</p>
                    {p.description && (
                      <p className="text-xs text-muted truncate">{p.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {p.category && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize
                          ${p.category === 'women' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>
                          {p.category === 'women' ? '👗' : '👔'} {p.category}
                        </span>
                      )}
                      {p.sizes && p.sizes.length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {p.sizes.join(' · ')}
                        </span>
                      )}
                      {p.images && p.images.length > 1 && (
                        <span className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full">
                          {p.images.length} images
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <span className="font-extrabold text-accent text-sm shrink-0">₹{p.price.toFixed(2)}</span>

                  {/* Delete */}
                  <button
                    onClick={() => del(p.id, p.title)}
                    disabled={deleting === p.id}
                    className="p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                    title="Delete product"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
