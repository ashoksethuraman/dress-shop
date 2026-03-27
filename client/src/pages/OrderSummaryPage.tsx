import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { removeFromCart, setQty } from '../store/cartSlice';
import {
  FiShoppingBag, FiTrash2, FiChevronRight, FiArrowLeft,
  FiTruck, FiShield, FiRefreshCw,
} from 'react-icons/fi';

export default function OrderSummaryPage() {
  const items    = useAppSelector((s) => s.cart.items);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const total    = subtotal; // free shipping

  /* ── Empty cart ── */
  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <FiShoppingBag size={52} className="text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">Your cart is empty</h2>
        <p className="text-sm text-gray-500 mb-6">Looks like you haven't added anything yet.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors no-underline"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Back link */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-6 transition-colors"
        >
          <FiArrowLeft size={15} /> Back to home
        </button>

        <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Order Summary</h1>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* ══ LEFT: Item list ══ */}
          <div className="flex flex-col gap-4">

            {/* Header row */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <span>Product</span>
              <span className="w-28 text-center">Quantity</span>
              <span className="w-20 text-right">Price</span>
              <span className="w-8" />
            </div>

            {/* Items */}
            {items.map((it) => (
              <div
                key={`${it.productId}-${it.size ?? 'none'}`}
                className="flex items-center gap-4 bg-white rounded-2xl px-4 py-4 shadow-sm"
              >
                {/* Thumbnail placeholder */}
                <div className="w-16 h-16 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                  <FiShoppingBag size={22} className="text-indigo-300" />
                </div>

                {/* Title + unit price */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{it.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {it.size && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 font-semibold px-2 py-0.5 rounded">Size: {it.size}</span>
                    )}
                    <span className="text-xs text-gray-400">₹{it.price.toFixed(2)} each</span>
                  </div>
                </div>

                {/* Qty stepper */}
                <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => dispatch(setQty({ productId: it.productId, size: it.size, qty: it.qty - 1 }))}
                    disabled={it.qty <= 1}
                    className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors text-base font-bold"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm font-semibold text-gray-800">{it.qty}</span>
                  <button
                    onClick={() => dispatch(setQty({ productId: it.productId, size: it.size, qty: it.qty + 1 }))}
                    className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 transition-colors text-base font-bold"
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <span className="w-20 text-right font-bold text-sm text-gray-800">
                  ₹{(it.price * it.qty).toFixed(2)}
                </span>

                {/* Remove */}
                <button
                  onClick={() => dispatch(removeFromCart({ productId: it.productId, size: it.size }))}
                  className="text-red-400 hover:text-red-600 transition-colors p-1 flex-shrink-0"
                  title="Remove item"
                >
                  <FiTrash2 size={15} />
                </button>
              </div>
            ))}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 mt-2">
              {[
                { icon: <FiTruck size={16} />, label: 'Free Delivery', sub: 'On all orders' },
                { icon: <FiRefreshCw size={16} />, label: 'Easy Returns', sub: '7-day policy' },
                { icon: <FiShield size={16} />, label: 'Secure Payment', sub: 'Razorpay encrypted' },
              ].map(({ icon, label, sub }) => (
                <div key={label} className="flex flex-col items-center text-center bg-white rounded-xl px-3 py-3 shadow-sm gap-1">
                  <span className="text-indigo-500">{icon}</span>
                  <p className="text-xs font-semibold text-gray-700">{label}</p>
                  <p className="text-[11px] text-gray-400">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ══ RIGHT: Price breakdown + promo ══ */}
          <div className="bg-white rounded-2xl shadow-sm px-6 py-6 flex flex-col gap-5 sticky top-6">

            <h2 className="text-base font-bold text-gray-800 border-b border-gray-100 pb-3">Price Details</h2>

            {/* Line items */}
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({items.reduce((a, i) => a + i.qty, 0)} items)</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className="text-green-600 font-medium">Free</span>
              </div>
              <div className="flex justify-between font-extrabold text-base text-gray-900 pt-2 border-t border-gray-100">
                <span>Total</span>
                <span className="text-indigo-600">₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => navigate('/checkout')}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg"
            >
              Proceed to Checkout
              <FiChevronRight size={16} />
            </button>

            <Link
              to="/"
              className="text-center text-xs text-gray-400 hover:text-indigo-500 transition-colors no-underline"
            >
              Continue Shopping
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
