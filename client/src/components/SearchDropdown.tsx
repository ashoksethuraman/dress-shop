import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../services/apiClient';
import { FiPackage } from 'react-icons/fi';
import type { Product } from '../utils/types';
import { getProductImage } from '../utils/imageHelper';
import { formatPrice } from '../utils/format';


type Props = {
  searchQuery: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function SearchDropdown({ searchQuery, isOpen, onClose }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || !isOpen) {
      setProducts([]);
      return;
    }

    const searchProducts = async () => {
      setLoading(true);
      try {
        const response = await productsApi.search(searchQuery);
        setProducts(response.products.slice(0, 5)); // Limit to 5 results
      } catch (error) {
        console.error('Search error:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
      {loading ? (
        <div className="p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#D9B3AF] border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-600">Searching products...</p>
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 divide-y divide-gray-100">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              onClick={onClose}
              className="p-5 hover:bg-gradient-to-r hover:from-[#f5e6e4] hover:to-[#f9ebe9] transition-all duration-200 group no-underline"
            >
              <div className="flex items-center gap-5">
                {/* Product Image */}
                <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow duration-200">
                  {(() => {
                    const imgMeta = getProductImage(product as any);
                    const [showPlaceholder, setShowPlaceholder] = [imgMeta.isPlaceholder, false];
                    return !imgMeta.isPlaceholder ? (
                      <img
                        src={imgMeta.src!}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const placeholder = parent.querySelector('.placeholder-icon');
                            if (placeholder) (placeholder as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : (
                      <div className="placeholder-icon absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#f5e6e4] to-[#f9ebe9]">
                        <FiPackage className="w-10 h-10 text-[#D9B3AF]" strokeWidth={1.5} />
                      </div>
                    );
                  })()}
                </div>
                
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-semibold text-gray-900 mb-1 truncate group-hover:text-[#8B6F6B] transition-colors duration-200">
                    {product.title}
                  </h4>
                  {product.category && (
                    <p className="text-sm text-gray-500 mb-2 capitalize">
                      {product.category}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-[#8B6F6B]">
                      {formatPrice(product.price) || '0.00'}
                    </span>
                    {product.stock && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        product.stock === 'available' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {product.stock === 'available' ? 'In Stock' : 'Out of Stock'}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Arrow Icon */}
                <div className="flex-shrink-0 text-gray-400 group-hover:text-[#8B6F6B] group-hover:translate-x-1 transition-all duration-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : searchQuery.trim().length > 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[#f5e6e4] to-[#f9ebe9] rounded-full flex items-center justify-center">
            <FiPackage className="w-8 h-8 text-[#D9B3AF]" strokeWidth={1.5} />
          </div>
          <p className="text-gray-600 font-medium">No products found</p>
          <p className="text-sm text-gray-500 mt-1">Try searching with different keywords</p>
        </div>
      ) : (
        <div className="p-12 text-center">
          <p className="text-gray-500">Start typing to search for products...</p>
        </div>
      )}
    </div>
  );
}