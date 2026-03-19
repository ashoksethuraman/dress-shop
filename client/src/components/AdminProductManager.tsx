import React, { useEffect, useState } from 'react';
import { firestoreService } from '../services/firestoreService';
import { Product } from '../utils/types';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

export default function AdminProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    firestoreService.getProducts().then(setProducts);
  }, []);

  const add = async () => {
    const p: Product = { id: 'p' + Date.now(), title, price: Number(price) || 0 };
    await firestoreService.addProduct(p);
    const all = await firestoreService.getProducts();
    setProducts(all);
    setTitle('');
    setPrice('');
  };

  const del = async (id: string) => {
    await firestoreService.deleteProduct(id);
    setProducts(await firestoreService.getProducts());
  };

  const inputCls = 'flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h2 className="text-2xl font-bold text-primary mb-6">Admin — Products</h2>

      {/* Add form */}
      <div className="flex gap-2 mb-6">
        <input
          placeholder="Product title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
        />
        <input
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
        />
        <button
          onClick={add}
          disabled={!title || !price}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          <FiPlus size={14} /> Add
        </button>
      </div>

      {/* Product list */}
      {products.length === 0 ? (
        <p className="text-muted text-sm">No products yet. Add one above.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p) => (
            <li key={p.id} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm">
              <span className="flex-1 text-sm font-medium text-primary">{p.title}</span>
              <span className="text-sm font-bold text-accent">₹{p.price.toFixed(2)}</span>
              <button
                onClick={() => del(p.id)}
                className="text-red-400 hover:text-red-600 transition-colors p-1"
                title="Delete"
              >
                <FiTrash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
