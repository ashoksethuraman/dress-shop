import React, { useState } from 'react';
import { FiPackage, FiShoppingBag } from 'react-icons/fi';
import ProductsTab from '../components/admin/ProductsTab';
import OrdersTab from '../components/admin/OrdersTab';

type AdminTab = 'products' | 'orders';

const TABS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: 'products', label: 'Add Product', icon: <FiPackage size={15} /> },
  { id: 'orders',   label: 'Orders',      icon: <FiShoppingBag size={15} /> },
];

export default function AdminPage() {
  const [activeTab, setActiveTab]         = useState<AdminTab>('products');
  const [ordersTabMounted, setOrdersMounted] = useState(false);

  const handleTabClick = (id: AdminTab) => {
    if (id === 'orders') setOrdersMounted(true);
    setActiveTab(id);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">

      {/* Header + tabs on same row */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            {activeTab === 'products' ? <FiPackage size={20} /> : <FiShoppingBag size={20} />}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-primary leading-tight">Admin Panel</h1>
            <p className="text-xs text-muted">Manage your store</p>
          </div>
        </div>

        {/* Tab buttons — right side */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${activeTab === id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'products' && <ProductsTab />}

      {/* Orders: lazy-mount — only rendered after first click, hidden when not active */}
      {ordersTabMounted && (
        <div className={activeTab === 'orders' ? '' : 'hidden'}>
          <OrdersTab />
        </div>
      )}

    </div>
  );
}
