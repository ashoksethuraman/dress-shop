import React, { useState } from 'react';
import { FiPackage, FiShoppingBag, FiSettings } from 'react-icons/fi';
import ProductsTab from '../components/admin/ProductsTab';
import OrdersTab from '../components/admin/OrdersTab';
import ConfigTab from '../components/admin/ConfigTab';

type AdminTab = 'products' | 'orders' | 'config';

const TABS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: 'products', label: 'Add Product', icon: <FiPackage size={15} /> },
  { id: 'config', label: 'Site Config', icon: <FiSettings size={15} /> },
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 pb-4 pt-20 md:pt-20 overflow-x-hidden">

      {/* Header + tabs - responsive layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <FiShoppingBag size={22} className="text-brand-dark shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-display">Admin Panel</h1>
        </div>

        {/* Tab buttons - responsive */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-full sm:w-fit overflow-x-auto">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap
                ${activeTab === id
                  ? 'bg-white shadow-sm text-brand-dark'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              {icon} <span className="hidden xs:inline sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'products' && <ProductsTab />}
      {activeTab === 'config' && <ConfigTab />}

      {/* Orders: lazy-mount — only rendered after first click, hidden when not active */}
      {ordersTabMounted && (
        <div className={activeTab === 'orders' ? '' : 'hidden'}>
          <OrdersTab />
        </div>
      )}

    </div>
  );
}