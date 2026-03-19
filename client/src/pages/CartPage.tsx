import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { removeFromCart, setQty } from '../store/cartSlice';
import { Link, useNavigate } from 'react-router-dom';
import { FiTrash2 } from 'react-icons/fi';

export default function CartPage() {
  const items = useAppSelector((s) => s.cart.items);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h2 className="text-2xl font-bold text-primary mb-6">Your Cart</h2>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-lg mb-4">Your cart is empty</p>
          <Link to="/" className="text-accent hover:underline font-semibold">Browse products →</Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3 mb-6">
            {items.map((it) => (
              <li key={it.productId} className="flex items-center gap-4 bg-white rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-primary">{it.title}</p>
                  <p className="text-xs text-muted">₹{it.price.toFixed(2)} each</p>
                </div>
                <input
                  type="number"
                  value={it.qty}
                  min={1}
                  onChange={(e) =>
                    dispatch(setQty({ productId: it.productId, qty: Number(e.target.value) || 0 }))
                  }
                  className="w-14 text-center border border-gray-200 rounded-lg py-1 text-sm outline-none focus:border-indigo-400"
                />
                <span className="font-semibold text-sm text-primary w-16 text-right">
                  ₹{(it.price * it.qty).toFixed(2)}
                </span>
                <button
                  onClick={() => dispatch(removeFromCart(it.productId))}
                  className="text-red-400 hover:text-red-600 transition-colors p-1"
                  title="Remove"
                >
                  <FiTrash2 size={16} />
                </button>
              </li>
            ))}
          </ul>

          {/* Totals */}
          <div className="bg-white rounded-2xl px-6 py-4 shadow-sm flex justify-between items-center mb-6">
            <span className="text-muted font-medium">Subtotal</span>
            <span className="text-xl font-extrabold text-accent">₹{subtotal.toFixed(2)}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              to="/"
              className="flex-1 text-center py-2.5 rounded-xl border border-indigo-300 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors no-underline text-sm"
            >
              Continue Shopping
            </Link>
            <button
              onClick={() => navigate('/order-summary')}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-colors"
            >
              Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
