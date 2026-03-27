import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { removeFromCart, setQty } from '../store/cartSlice';
import { Link, useNavigate } from 'react-router-dom';
import { FiTrash2, FiShoppingBag, FiArrowRight } from 'react-icons/fi';

export default function CartPage() {
  const items = useAppSelector((s) => s.cart.items);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [stockError, setStockError] = useState<string | null>(null);

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  const handleCheckout = () => {
    const outOfStockItem = items.find((i) => i.stock === 'out_of_stock');
    if (outOfStockItem) {
      setStockError(`Your cart has an out of stock item, please remove "${outOfStockItem.title}".`);
      return;
    }
    setStockError(null);
    navigate('/order-summary');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4 shadow-inner">
            <FiShoppingBag size={28} className="text-indigo-300" />
          </div>

          {/* Text */}
          <h3 className="text-lg font-bold text-primary mb-1">Your cart is empty</h3>
          <p className="text-muted text-sm mb-6 text-center max-w-xs">
            Looks like you haven't added anything yet. Explore our collection and find something you love!
          </p>

          {/* CTA Button */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm shadow-md shadow-indigo-200 transition-all no-underline"
          >
            Browse Products <FiArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-primary mb-6">Your Cart</h2>
          <ul className="flex flex-col gap-3 mb-6">
            {items.map((it) => (
              <li key={`${it.productId}-${it.size ?? 'none'}`} className="flex items-center gap-4 bg-white rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-primary">{it.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {it.size && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 font-semibold px-2 py-0.5 rounded">Size: {it.size}</span>
                    )}
                    <span className="text-xs text-muted">₹{it.price.toFixed(2)} each</span>
                  </div>
                  {it.stock === 'out_of_stock' && (
                    <span className="inline-block mt-1 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                      Out of Stock
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={it.qty}
                  min={1}
                  onChange={(e) =>
                    dispatch(setQty({ productId: it.productId, size: it.size, qty: Number(e.target.value) || 0 }))
                  }
                  className="w-14 text-center border border-gray-200 rounded-lg py-1 text-sm outline-none focus:border-indigo-400"
                />
                <span className="font-semibold text-sm text-primary w-16 text-right">
                  ₹{(it.price * it.qty).toFixed(2)}
                </span>
                <button
                  onClick={() => dispatch(removeFromCart({ productId: it.productId, size: it.size }))}
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
              onClick={handleCheckout}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-colors"
            >
              Checkout
            </button>
          </div>
          {stockError && (
            <div className="mt-3 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {stockError}
            </div>
          )}
        </>
      )}
    </div>
  );
}
