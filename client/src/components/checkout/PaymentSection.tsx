import React from 'react';
import { FiLock } from 'react-icons/fi';

type Props = {
  loading: boolean;
  disabled: boolean;
};

export default function PaymentSection({ loading, disabled }: Props) {
  return (
    <>
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Payment</h2>
        <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
          <FiLock size={11} /> All transactions are secure and encrypted.
        </p>
        <div className="border-2 border-brand-dark rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-brand">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-brand-dark bg-brand-dark flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <span className="text-sm font-semibold text-gray-800">Razorpay Secure</span>
              <span className="text-xs text-gray-500">(UPI, Cards, Int'l Cards, Wallets)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded">UPI</span>
              <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded">VISA</span>
              <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">MC</span>
            </div>
          </div>
          <div className="px-4 py-3 bg-white text-sm text-gray-600 text-center">
            You'll be redirected to Razorpay Secure to complete your purchase.
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={disabled}
        className="w-full py-4 rounded-xl bg-brand-dark hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
      >
        <FiLock size={16} />
        {loading ? 'Processing…' : 'Pay now'}
      </button>

      <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-8">
        {['Refund policy', 'Shipping policy', 'Privacy policy', 'Terms of service'].map((l) => (
          <button type="button" key={l} className="hover:text-brand-dark transition-colors">
            {l}
          </button>
        ))}
      </div>
    </>
  );
}
