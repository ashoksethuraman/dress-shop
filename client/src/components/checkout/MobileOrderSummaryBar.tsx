import React, { useState } from 'react';
import { FiShoppingBag, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import OrderSummaryPanel from './OrderSummaryPanel';
import { formatPrice } from '../../utils/format';
import type { CartItem } from '../../utils/types';

type Props = {
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  total: number;
};

export default function MobileOrderSummaryBar({ items, subtotal, taxAmount, shippingFee, total }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-brand-dark"
      >
        <span className="flex items-center gap-2">
          <FiShoppingBag size={16} />
          {open ? 'Hide' : 'Show'} order summary
          {open ? <FiChevronUp size={15} /> : <FiChevronDown size={15} />}
        </span>
        <span className="text-gray-900 font-bold">
          {formatPrice(total)}{' '}
          <span className="text-xs font-normal text-gray-400">(incl. GST)</span>
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
          <OrderSummaryPanel
            items={items}
            subtotal={subtotal}
            taxAmount={taxAmount}
            shippingFee={shippingFee}
            total={total}
          />
        </div>
      )}
    </div>
  );
}
