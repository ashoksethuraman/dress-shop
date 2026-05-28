import React from 'react';
import { FiShoppingBag } from 'react-icons/fi';
import { formatPrice } from '../../utils/format';

type OrderSummaryItem = {
  productId: string;
  title: string;
  price: number;
  qty: number;
  size?: string | null;
  ageSize?: string | null;
};

type OrderSummaryPanelProps = {
  items: OrderSummaryItem[];
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  total: number;
};

export default function OrderSummaryPanel({
  items,
  subtotal,
  taxAmount,
  shippingFee,
  total,
}: OrderSummaryPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <div key={it.productId} className="flex items-center gap-3">
          <div className="relative w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
            <FiShoppingBag size={20} className="text-gray-400" />
            <span className="absolute -top-1.5 -right-1.5 bg-brand-dark text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {it.qty}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{it.title}</p>
            {it.size && (
              <p className="text-xs text-gray-500 mt-0.5">Size: {it.size}</p>
            )}
            {it.ageSize && (
              <p className="text-xs text-gray-500 mt-0.5">Age: {it.ageSize} years</p>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800">{formatPrice(it.price * it.qty)}</p>
        </div>
      ))}
      <div className="border-t border-gray-200 pt-3 flex flex-col gap-1.5">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {/* <div className="flex justify-between text-sm text-gray-600">
          <span>GST (18%)</span>
          <span>{formatPrice(taxAmount)}</span>
        </div> */}
        <div className="flex justify-between text-sm text-gray-600">
          <span>Shipping</span>
          {shippingFee === 0
            ? <span className="text-green-600 font-medium">Free</span>
            : <span>{formatPrice(shippingFee)}</span>
          }
        </div>
        <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
          <span>Total</span>
          <span className="text-brand-dark">{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
}