import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiSearch, FiShoppingBag, FiPackage, FiTruck, FiCheckCircle,
  FiAlertCircle, FiMapPin, FiInfo, FiClock, FiXCircle,
} from 'react-icons/fi';
import { useLazyTrackOrderQuery } from '../store/apiSlice';
import { formatPrice } from '../utils/format';

/* ─── Tracking steps definition ─────────────────────────── */
const STEPS = [
  { key: 'PLACED',    label: 'Order Placed', Icon: FiShoppingBag },
  { key: 'SHIPPED',   label: 'Shipped',      Icon: FiPackage     },
  { key: 'DELIVERED', label: 'Delivered',    Icon: FiCheckCircle },
] as const;

function stepIndex(status: string): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

export default function ShippingPage() {
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [order,         setOrder]         = useState<any>(null);
  const [error,         setError]         = useState('');

  // Searching the same order ID within that window returns instantly from cache.
  const [triggerTrack] = useLazyTrackOrderQuery();

  const handleTrack = async () => {
    const id = input.trim();
    if (!id) { setError('Please enter an order number.'); return; }
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      // .unwrap() throws on error so the catch block handles it uniformly
      const found = await triggerTrack(id).unwrap();
      setOrder(found);
    } catch (err: any) {
      if (err?.error?.includes('404') || err?.message?.includes('404')) {
        setError('No order found with that order number. Please check and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const addr       = order?.shippingAddress ?? {};
  const isPending  = order?.orderStatus === 'PENDING';
  const isFailed   = order?.orderStatus === 'PAYMENT_FAILED' || order?.orderStatus === 'CANCELLED';
  const currentStep = order && !isPending && !isFailed ? stepIndex(order.orderStatus ?? 'PLACED') : 0;
  const isDelivered = !isPending && !isFailed && currentStep === STEPS.length - 1;

  /* ── Status label for Order Info badge ── */
  function statusLabel(): string {
    if (isPending) return 'Awaiting Payment';
    if (order?.orderStatus === 'PAYMENT_FAILED') return 'Payment Failed';
    if (order?.orderStatus === 'CANCELLED') return 'Cancelled';
    if (isDelivered) return 'Delivered';
    return STEPS[currentStep].label;
  }

  function statusBadgeClass(): string {
    if (isPending) return 'bg-amber-100 text-amber-700';
    if (isFailed)  return 'bg-red-100 text-red-700';
    if (isDelivered) return 'bg-green-100 text-green-700';
    return 'bg-brand text-brand-dark';
  }

  return (
    <div className="bg-bg">
      {/* Page header */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <FiTruck size={22} className="text-brand-dark" />
          <h1 className="text-2xl font-bold text-gray-900 font-display">Shipping / Tracking</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">

        {/* ── Search bar ── */}
        <div className="bg-brand rounded-2xl border border-brand-border shadow-sm px-5 py-5 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Enter your order number
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
              placeholder="e.g. DS-1234567890"
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-brand-dark focus:ring-brand transition-all"
            />
            <button
              onClick={handleTrack}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-dark hover:bg-brand-hover disabled:opacity-50 text-white font-bold text-sm transition-colors flex-shrink-0"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <FiSearch size={15} />}
              {loading ? 'Searching…' : 'Track'}
            </button>
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-red-500">
              <FiAlertCircle size={14} /> {error}
            </p>
          )}
        </div>

        {/* ── Results ── */}
        {order && (
          <div className="flex flex-col gap-5">

            {/* Status header */}
            {isPending ? (
              <div className="rounded-2xl px-5 py-4 flex items-center gap-3 bg-amber-50 border border-amber-200">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600">
                  <FiClock size={20} />
                </div>
                <div>
                  <p className="font-bold text-base text-amber-700">Awaiting Payment</p>
                  <p className="text-xs text-gray-500 mt-0.5">Order #{order.id} · Payment not yet confirmed</p>
                </div>
              </div>
            ) : isFailed ? (
              <div className="rounded-2xl px-5 py-4 flex items-center gap-3 bg-red-50 border border-red-200">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-red-100 text-red-500">
                  <FiXCircle size={20} />
                </div>
                <div>
                  <p className="font-bold text-base text-red-700">
                    {order.orderStatus === 'PAYMENT_FAILED' ? 'Payment Failed' : 'Order Cancelled'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Order #{order.id} · No charge was made</p>
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${
                isDelivered ? 'bg-green-50 border border-green-200' : 'bg-brand border border-brand-border'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isDelivered ? 'bg-green-100 text-green-600' : 'bg-brand text-brand-dark'
                }`}>
                  {isDelivered ? <FiCheckCircle size={20} /> : <FiTruck size={20} />}
                </div>
                <div>
                  <p className={`font-bold text-base ${isDelivered ? 'text-green-700' : 'text-brand-dark'}`}>
                    {isDelivered ? 'Delivered' : STEPS[currentStep].label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Order #{order.id}
                    {isDelivered && ' · Package was handed to resident'}
                  </p>
                </div>
              </div>
            )}

            {/* ── Tracking stepper ── */}
            {!isPending && !isFailed && (
              <div className="bg-brand rounded-2xl border border-brand-border shadow-sm px-6 py-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-5">Shipment progress</p>

                {/* Desktop stepper */}
                <div className="hidden sm:flex items-start justify-between relative">
                  {/* Connecting line */}
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0 mx-8" />
                  <div
                    className="absolute top-5 left-0 h-0.5 bg-brand-dark z-0 ml-8 transition-all duration-700"
                    style={{ width: `calc(${(currentStep / (STEPS.length - 1)) * 100}% - 4rem)` }}
                  />

                  {STEPS.map(({ key, label, Icon }, i) => {
                    const done   = i <= currentStep;
                    const active = i === currentStep;
                    return (
                      <div key={key} className="flex flex-col items-center gap-2 z-10 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                          ${done
                            ? 'bg-brand-dark border-brand-dark text-white'
                            : 'bg-white border-gray-300 text-gray-400'}
                          ${active ? 'ring-4 ring-brand' : ''}`}
                        >
                          <Icon size={18} />
                        </div>
                        <span className={`text-xs font-semibold text-center ${done ? 'text-brand-dark' : 'text-gray-400'}`}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile stepper (vertical) */}
                <div className="flex sm:hidden flex-col gap-0">
                  {STEPS.map(({ key, label, Icon }, i) => {
                    const done   = i <= currentStep;
                    const active = i === currentStep;
                    const last   = i === STEPS.length - 1;
                    return (
                      <div key={key} className="flex items-stretch gap-3">
                        {/* Icon + vertical line */}
                        <div className="flex flex-col items-center">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all
                            ${done ? 'bg-brand-dark border-brand-dark text-white' : 'bg-white border-gray-300 text-gray-400'}
                            ${active ? 'ring-4 ring-brand' : ''}`}
                          >
                            <Icon size={16} />
                          </div>
                          {!last && (
                            <div className={`w-0.5 flex-1 my-1 ${i < currentStep ? 'bg-brand-dark' : 'bg-gray-200'}`} style={{ minHeight: 20 }} />
                          )}
                        </div>
                        {/* Label */}
                        <div className="pt-1.5 pb-4">
                          <p className={`text-sm font-semibold ${done ? 'text-brand-dark' : 'text-gray-400'}`}>{label}</p>
                          {active && !isDelivered && (
                            <p className="text-xs text-gray-400 mt-0.5">Current status</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Tracking ID + updates row ── */}
            <div className="bg-brand rounded-2xl border border-brand-border shadow-sm px-5 py-4">
              <p className="text-sm font-semibold text-gray-700">
                Tracking ID: <span className="font-mono text-gray-900">{order.id}</span>
              </p>
              <p className="text-xs text-brand-dark mt-1 cursor-pointer hover:underline">See all updates</p>
            </div>

            {/* ── Address + Order Info ── */}
            <div className="grid sm:grid-cols-2 gap-4">

              {/* Shipping Address */}
              <div className="bg-brand rounded-2xl border border-brand-border shadow-sm px-5 py-5">
                <p className="flex items-center gap-1.5 text-sm font-bold text-gray-800 mb-3">
                  <FiMapPin size={14} className="text-brand-dark" /> Shipping Address
                </p>
                <div className="text-sm text-gray-600 flex flex-col gap-0.5">
                  <p className="font-semibold text-gray-800">{addr.name}</p>
                  <p>{addr.line1}</p>
                  {addr.line2 && <p>{addr.line2}</p>}
                  <p>{addr.city}, {addr.state} {addr.pincode}</p>
                  <p>{addr.country || 'India'}</p>
                  {addr.phone && <p className="text-gray-400 text-xs mt-1">📞 {addr.phone}</p>}
                </div>
              </div>

              {/* Order Info */}
              <div className="bg-brand rounded-2xl border border-brand-border shadow-sm px-5 py-5">
                <p className="flex items-center gap-1.5 text-sm font-bold text-gray-800 mb-3">
                  <FiInfo size={14} className="text-brand-dark" /> Order Info
                </p>
                <div className="flex flex-col gap-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Method</span>
                    <span className="font-semibold text-gray-800">
                      {order.paymentMethod
                        ? order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1)
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Payment</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      order.paymentStatus === 'SUCCESS'   ? 'bg-green-100 text-green-700'  :
                      order.paymentStatus === 'FAILED'    ? 'bg-red-100 text-red-700'      :
                      order.paymentStatus === 'CANCELLED' ? 'bg-gray-100 text-gray-500'    :
                      order.paymentStatus === 'REFUNDED'  ? 'bg-purple-100 text-purple-700':
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {order.paymentStatus ?? 'PENDING'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Items</span>
                    <span className="font-semibold text-gray-800">
                      {order.items?.reduce((a: number, i: any) => a + i.qty, 0) ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="font-semibold text-brand-dark">{formatPrice(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                    <span>Order Status</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadgeClass()}`}>
                      {statusLabel()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Items list ── */}
            <div className="bg-brand rounded-2xl border border-brand-border shadow-sm overflow-hidden">
              <p className="px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                Items in this order
              </p>
              <div className="divide-y divide-gray-100">
                {order.items?.map((it: any) => (
                  <Link
                    key={it.productId}
                    to={`/product/${it.productId}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-brand transition-colors no-underline"
                  >
                    <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center flex-shrink-0 border border-brand-border">
                      <FiPackage size={18} className="text-brand-dark" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{it.title}</p>
                      <p className="text-xs text-gray-400">Qty: {it.qty} · ₹{it.unitPrice?.toFixed(2)} each</p>
                    </div>
                    <p className="text-sm font-bold text-gray-800 flex-shrink-0">
                      ₹{it.total?.toFixed(2)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
