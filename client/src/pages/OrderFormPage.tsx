import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { clearCart } from '../store/cartSlice';
import { generateOrderId } from '../utils/generateOrderId';
import { firestoreService } from '../services/firestoreService';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle } from 'react-icons/fi';

export default function OrderFormPage() {
  const user = useAppSelector((s) => s.user.user);
  const items = useAppSelector((s) => s.cart.items);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const placeOrder = async () => {
    setLoading(true);
    const orderId = generateOrderId();
    const order = { id: orderId, user: user || { id: 'guest' }, name, address, items, total };
    await firestoreService.createOrder(order);
    dispatch(clearCart());
    navigate('/order-success', { state: { order } });
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all';

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h2 className="text-2xl font-bold text-primary mb-6">Order Details</h2>

      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Delivery Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, city, postal code"
            className={inputCls}
          />
        </div>

        {/* Order summary */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
          <ul className="flex flex-col gap-1 text-sm text-gray-700">
            {items.map(it => (
              <li key={it.productId} className="flex justify-between">
                <span>{it.title} × {it.qty}</span>
                <span className="font-semibold">${(it.price * it.qty).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between font-bold text-base text-accent mt-3 pt-3 border-t border-gray-100">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <button
        onClick={placeOrder}
        disabled={!name || !address || items.length === 0 || loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <FiCheckCircle size={16} />
        {loading ? 'Placing Order...' : 'Create Order & Pay (placeholder)'}
      </button>
    </div>
  );
}
