import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { removeFromCart, setQty } from '../store/cartSlice';
import { Link, useNavigate } from 'react-router-dom';
import { FiTrash2, FiShoppingBag, FiArrowLeft, FiChevronRight, FiTruck, FiShield, FiRefreshCw } from 'react-icons/fi';
import { formatPrice } from '../utils/format';
import { calcOrderTotals, FREE_SHIPPING } from '../utils/priceLevel';

export default function CartPage() {
  const items    = useAppSelector((s) => s.cart.items);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [stockError, setStockError] = useState<string | null>(null);
  const [qtyErrors,  setQtyErrors]  = useState<Record<string, string>>({});

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const { taxAmount, shippingFee, totalAmount } = calcOrderTotals(subtotal);

  const handleCheckout = () => {
    const outOfStockItem = items.find((i) => i.stock === 'out_of_stock');
    if (outOfStockItem) {
      setStockError(`Your cart has an out of stock item, please remove "${outOfStockItem.title}".`);
      return;
    }
    setStockError(null);
    navigate('/checkout');
  };

  /* ── Empty cart ── */
  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <FiShoppingBag size={52} className="text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">Your cart is empty</h2>
        <p className="text-sm text-gray-500 mb-6">Looks like you haven't added anything yet.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-dark text-white font-semibold text-sm hover:bg-brand-hover transition-colors no-underline"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-8">

        {/* Back link */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-brand-dark hover:text-brand-hover font-medium mb-6 transition-colors"
        >
          <FiArrowLeft size={15} /> Back
        </button>

        <h1 className="text-2xl font-extrabold text-gray-900 mb-6">
          My Cart{' '}
          <span className="text-base font-semibold text-gray-400">
            ({items.length} {items.length === 1 ? 'item' : 'items'})
          </span>
        </h1>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* ══ LEFT: Item list ══ */}
          <div className="flex flex-col gap-4">
            {items.map((it) => {
              const key = `${it.productId}-${it.size ?? 'none'}`;
              return (
                <div key={key} className="bg-white rounded-2xl px-4 py-4 shadow-sm">
                  {/* Row 1: thumbnail + info + remove */}
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-brand flex items-center justify-center flex-shrink-0 border border-brand-border">
                      <FiShoppingBag size={20} className="text-brand-dark" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 line-clamp-2 leading-snug">{it.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {it.size && (
                          <span className="text-xs bg-brand text-brand-dark border border-brand-border font-semibold px-2 py-0.5 rounded">
                            Size: {it.size}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{formatPrice(it.price)} each</span>
                      </div>
                      {it.stock === 'out_of_stock' && (
                        <span className="inline-block mt-1 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                          Out of Stock
                        </span>
                      )}
                      {qtyErrors[key] && (
                        <span className="inline-block mt-1 text-xs font-medium text-red-500">{qtyErrors[key]}</span>
                      )}
                    </div>
                    <button
                      onClick={() => dispatch(removeFromCart({ productId: it.productId, size: it.size }))}
                      className="text-red-400 hover:text-red-600 transition-colors p-1 flex-shrink-0"
                      title="Remove item"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>

                  {/* Row 2: qty stepper + line total */}
                  <div className="flex items-center justify-between mt-3 pl-[68px]">
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => {
                          const newQty = it.qty - 1;
                          if (newQty < 1) return;
                          dispatch(setQty({ productId: it.productId, size: it.size, qty: newQty }));
                        }}
                        disabled={it.qty <= 1}
                        className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors font-bold"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-gray-800">{it.qty}</span>
                      <button
                        onClick={() => {
                          const newQty = it.qty + 1;
                          if (it.maxQty !== undefined && newQty > it.maxQty) {
                            setQtyErrors((prev) => ({ ...prev, [key]: `Max ${it.maxQty} unit${it.maxQty !== 1 ? 's' : ''} available` }));
                            return;
                          }
                          setQtyErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
                          dispatch(setQty({ productId: it.productId, size: it.size, qty: newQty }));
                        }}
                        disabled={it.maxQty !== undefined && it.qty >= it.maxQty}
                        className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors font-bold"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-bold text-sm text-gray-800">{formatPrice(it.price * it.qty)}</span>
                  </div>
                </div>
              );
            })}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 mt-2">
              {[
                { icon: <FiTruck size={16} />, label: 'Free Shipping', sub: 'Orders above ₹999' },
                { icon: <FiRefreshCw size={16} />, label: 'Easy Returns', sub: '7-day policy' },
                { icon: <FiShield size={16} />, label: 'Secure Payment', sub: 'Razorpay encrypted' },
              ].map(({ icon, label, sub }) => (
                <div key={label} className="flex flex-col items-center text-center bg-white rounded-xl px-3 py-3 shadow-sm gap-1">
                  <span className="text-brand-dark">{icon}</span>
                  <p className="text-xs font-semibold text-gray-700">{label}</p>
                  <p className="text-[11px] text-gray-400">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ══ RIGHT: Price breakdown ══ */}
          <div className="bg-white rounded-2xl shadow-sm px-6 py-6 flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">

            <h2 className="text-base font-bold text-gray-800 border-b border-gray-100 pb-3">Price Details</h2>

            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({items.reduce((a, i) => a + i.qty, 0)} items)</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>GST (18%)</span>
                <span>{formatPrice(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                {shippingFee === 0
                  ? <span className="text-green-600 font-medium">Free</span>
                  : <span>{formatPrice(shippingFee)}</span>
                }
              </div>
              {subtotal < FREE_SHIPPING && (
                <p className="text-xs text-gray-400">
                  Add {formatPrice(FREE_SHIPPING - subtotal)} more for free shipping
                </p>
              )}
              <div className="flex justify-between font-extrabold text-base text-gray-900 pt-2 border-t border-gray-100">
                <span>Total</span>
                <span className="text-brand-dark">{formatPrice(totalAmount)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-dark hover:bg-brand-hover text-white font-bold text-sm transition-all shadow-md hover:shadow-lg"
            >
              Proceed to Checkout
              <FiChevronRight size={16} />
            </button>

            <Link
              to="/"
              className="text-center text-sm text-gray-400 hover:text-brand-dark transition-colors no-underline"
            >
              Continue Shopping
            </Link>

            {stockError && (
              <div className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {stockError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
