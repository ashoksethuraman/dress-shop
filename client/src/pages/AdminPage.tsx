import React, { useState } from 'react';
import { FiPackage, FiShoppingBag } from 'react-icons/fi';
import ProductsTab from '../components/admin/ProductsTab';
import OrdersTab from '../components/admin/OrdersTab';

type AdminTab = 'products' | 'orders';

const TABS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: 'products', label: 'Add Product', icon: <FiPackage size={15} /> },
  // { id: 'orders',   label: 'Orders',      icon: <FiShoppingBag size={15} /> },
];

export default function AdminPage() {
  const [activeTab, setActiveTab]         = useState<AdminTab>('products');
  const [ordersTabMounted, setOrdersMounted] = useState(false);

  const handleTabClick = (id: AdminTab) => {
    if (id === 'orders') setOrdersMounted(true);
    setActiveTab(id);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-6">

      {/* Header + tabs on the same row, tabs pushed to the right */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <FiShoppingBag size={22} className="text-brand-dark" />
          <h1 className="text-2xl font-bold text-gray-900 font-display">Admin Panel</h1>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${activeTab === id
                  ? 'bg-white shadow-sm text-brand-dark'
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
