import React from 'react';

type Props = {
  hasAddress: boolean;
};

export default function ShippingMethodSection({ hasAddress }: Props) {
  return (
    <section>
      <h2 className="text-lg font-bold text-gray-900 mb-3">Shipping method</h2>
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 text-sm text-gray-500">
        {hasAddress ? (
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Standard Delivery (5–7 days)</span>
            <span className="text-green-600 font-semibold">Free</span>
          </div>
        ) : (
          'Enter your shipping address to view available shipping methods.'
        )}
      </div>
    </section>
  );
}
