import React, { useState } from 'react';
import { FiPackage, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import { productsApi } from '../../services/apiClient';
import { invalidateProductsCache } from '../../services/firestoreService';
import AddProductForm from '../AddProduct';
import { useProducts } from '../../hooks/useProducts';

export default function ProductsTab() {
  const { products, loading, refresh } = useProducts({ includeAll: true });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter]     = useState<'all' | 'men' | 'women'>('all');

  const del = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    setDeleting(id);
    try {
      await productsApi.delete(id);
    } catch { /* CF unavailable */ }
    invalidateProductsCache();
    refresh({ bust: true });
    setDeleting(null);
  };

  const visible = filter === 'all' ? products : products.filter((p) => p.category === filter);

  return (
    <div>
      {/* Add Product Form */}
      <AddProductForm onAdded={refresh} />

      {/* Product list */}
      <div className="mt-10">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-primary">All Products</h3>
            <span className="text-sm font-medium text-muted">({visible.length})</span>
          </div>
          <div className="flex items-center gap-2">
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
            <button
              onClick={() => refresh({ bust: true })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FiRefreshCw size={13} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map((i) => (
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
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {thumb
                      ? <img src={thumb} alt={p.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">👗</div>
                    }
                  </div>
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        p.stock === 'out_of_stock'
                          ? 'bg-red-50 text-red-500 border border-red-200'
                          : 'bg-green-50 text-green-600 border border-green-200'
                      }`}>
                        {p.stock === 'out_of_stock' ? 'Out of Stock' : 'Available'}
                      </span>
                      {p.images && p.images.length > 1 && (
                        <span className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full">
                          {p.images.length} images
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-extrabold text-accent text-sm shrink-0">₹{p.price.toFixed(2)}</span>
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
