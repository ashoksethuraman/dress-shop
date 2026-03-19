import React, { useState } from 'react';
import {
  FiSearch, FiShoppingBag, FiPackage, FiTruck, FiCheckCircle,
  FiAlertCircle, FiMapPin, FiInfo,
} from 'react-icons/fi';
import { firestoreService } from '../services/firestoreService';

/* ─── Tracking steps definition ─────────────────────────── */
const STEPS = [
  { key: 'order_placed', label: 'Order Placed',  Icon: FiShoppingBag },
  { key: 'shipped',      label: 'Shipped',        Icon: FiPackage     },
  { key: 'in_transit',   label: 'In Transit',     Icon: FiTruck       },
  { key: 'delivered',    label: 'Delivered',      Icon: FiCheckCircle },
] as const;

type StepKey = typeof STEPS[number]['key'];

function stepIndex(status: string): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

export default function ShippingPage() {
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [order,   setOrder]   = useState<any>(null);
  const [error,   setError]   = useState('');

  const handleTrack = async () => {
    const id = input.trim();
    if (!id) { setError('Please enter an order number.'); return; }
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const found = await firestoreService.getOrderById(id);
      if (!found) {
        setError('No order found with that order number. Please check and try again.');
      } else {
        setOrder(found);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addr        = order?.shippingAddress ?? {};
  const currentStep = order ? stepIndex(order.status ?? 'order_placed') : 0;
  const isDelivered = currentStep === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* ── Page title ── */}
        <div className="flex items-center gap-3 mb-6">
          <FiTruck size={24} className="text-indigo-500" />
          <h1 className="text-2xl font-extrabold text-gray-900">Track Your Order</h1>
        </div>

        {/* ── Search bar ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-5 mb-6">
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
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-100 transition-all"
            />
            <button
              onClick={handleTrack}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm transition-colors flex-shrink-0"
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
            <div className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${
              isDelivered ? 'bg-green-50 border border-green-200' : 'bg-indigo-50 border border-indigo-200'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isDelivered ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'
              }`}>
                {isDelivered ? <FiCheckCircle size={20} /> : <FiTruck size={20} />}
              </div>
              <div>
                <p className={`font-bold text-base ${isDelivered ? 'text-green-700' : 'text-indigo-700'}`}>
                  {isDelivered ? 'Delivered' : STEPS[currentStep].label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Order #{order.id}
                  {isDelivered && ' · Package was handed to resident'}
                </p>
              </div>
            </div>

            {/* ── Tracking stepper ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-5">Shipment progress</p>

              {/* Desktop stepper */}
              <div className="hidden sm:flex items-start justify-between relative">
                {/* Connecting line */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0 mx-8" />
                <div
                  className="absolute top-5 left-0 h-0.5 bg-indigo-500 z-0 ml-8 transition-all duration-700"
                  style={{ width: `calc(${(currentStep / (STEPS.length - 1)) * 100}% - 4rem)` }}
                />

                {STEPS.map(({ key, label, Icon }, i) => {
                  const done   = i <= currentStep;
                  const active = i === currentStep;
                  return (
                    <div key={key} className="flex flex-col items-center gap-2 z-10 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                        ${done
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-gray-300 text-gray-400'}
                        ${active ? 'ring-4 ring-indigo-100' : ''}`}
                      >
                        <Icon size={18} />
                      </div>
                      <span className={`text-xs font-semibold text-center ${done ? 'text-indigo-700' : 'text-gray-400'}`}>
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
                          ${done ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-400'}
                          ${active ? 'ring-4 ring-indigo-100' : ''}`}
                        >
                          <Icon size={16} />
                        </div>
                        {!last && (
                          <div className={`w-0.5 flex-1 my-1 ${i < currentStep ? 'bg-indigo-500' : 'bg-gray-200'}`} style={{ minHeight: 20 }} />
                        )}
                      </div>
                      {/* Label */}
                      <div className="pt-1.5 pb-4">
                        <p className={`text-sm font-semibold ${done ? 'text-indigo-700' : 'text-gray-400'}`}>{label}</p>
                        {active && !isDelivered && (
                          <p className="text-xs text-gray-400 mt-0.5">Current status</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Tracking ID + updates row ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
              <p className="text-sm font-semibold text-gray-700">
                Tracking ID: <span className="font-mono text-gray-900">{order.id}</span>
              </p>
              <p className="text-xs text-indigo-500 mt-1 cursor-pointer hover:underline">See all updates</p>
            </div>

            {/* ── Address + Order Info ── */}
            <div className="grid sm:grid-cols-2 gap-4">

              {/* Shipping Address */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-5">
                <p className="flex items-center gap-1.5 text-sm font-bold text-gray-800 mb-3">
                  <FiMapPin size={14} className="text-indigo-500" /> Shipping Address
                </p>
                <div className="text-sm text-gray-600 flex flex-col gap-0.5">
                  <p className="font-semibold text-gray-800">{addr.firstName} {addr.lastName}</p>
                  {addr.company && <p>{addr.company}</p>}
                  <p>{addr.address}</p>
                  {addr.apartment && <p>{addr.apartment}</p>}
                  <p>{addr.city}, {addr.state} {addr.pinCode}</p>
                  <p>India</p>
                  {addr.phone && <p className="text-gray-400 text-xs mt-1">📞 {addr.phone}</p>}
                </div>
              </div>

              {/* Order Info */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-5">
                <p className="flex items-center gap-1.5 text-sm font-bold text-gray-800 mb-3">
                  <FiInfo size={14} className="text-indigo-500" /> Order Info
                </p>
                <div className="flex flex-col gap-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Payment</span>
                    <span className="font-semibold text-gray-800">Razorpay</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Items</span>
                    <span className="font-semibold text-gray-800">
                      {order.items?.reduce((a: number, i: any) => a + i.qty, 0) ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="font-semibold text-indigo-600">₹{order.total?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span>Status</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isDelivered
                        ? 'bg-green-100 text-green-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {isDelivered ? 'Delivered' : STEPS[currentStep].label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Items list ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <p className="px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                Items in this order
              </p>
              <div className="divide-y divide-gray-100">
                {order.items?.map((it: any) => (
                  <div key={it.productId} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                      <FiPackage size={18} className="text-indigo-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{it.title}</p>
                      <p className="text-xs text-gray-400">Qty: {it.qty} · ₹{it.price.toFixed(2)} each</p>
                    </div>
                    <p className="text-sm font-bold text-gray-800 flex-shrink-0">
                      ₹{(it.price * it.qty).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

