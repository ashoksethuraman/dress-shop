import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { clearCart } from '../store/cartSlice';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { generateOrderId } from '../utils/generateOrderId';
import { firestoreService } from '../services/firestoreService';
import { initRazorpayPayment } from '../services/paymentService';
import { FiChevronDown, FiChevronUp, FiLock, FiShoppingBag } from 'react-icons/fi';
import { CheckoutFormState } from '../utils/types';
import AddressSection from '../components/AddressSection';

/* ─── Reusable registered input ─────────────────────────── */
function Field({
  label, id, error, placeholder, type = 'text', optional = false, registration,
}: {
  label: string; id: string; error?: string; placeholder?: string;
  type?: string; optional?: boolean; registration: object;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-gray-500">
        {label}{optional && <span className="text-gray-400 ml-1">(optional)</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder ?? label}
        {...registration}
        className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all
          ${error ? 'border-red-400 focus:ring-red-100' : 'border-gray-300 focus:border-indigo-400 focus:ring-indigo-100'}`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function CheckoutPage() {
  const items    = useAppSelector((s) => s.cart.items);
  const user     = useAppSelector((s) => s.user.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const total    = subtotal; // free shipping

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [loading, setLoading]         = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormState>({
    defaultValues: { billingOption: 'same', emailOffers: false, saveInfo: false, textOffers: false },
  });

  const billingOption    = watch('billingOption');
  const shippingAddress  = watch('shippingAddress.address' as any);
  const shippingState    = watch('shippingAddress.state' as any);

  /* ── Submit ── */
  const onSubmit = async (form: CheckoutFormState) => {
    setLoading(true);
    try {
      const orderId   = generateOrderId();
      const orderData = {
        id: orderId,
        user: user || { id: 'guest' },
        contactEmail: form.email,
        billingAndShippingAddressSame: form.billingOption === 'same',
        shippingAddress: form.shippingAddress,
        billingAddress: form.billingOption === 'same'
          ? form.shippingAddress
          : form.billingAddress,
        items,
        total,
      };

      await initRazorpayPayment({
        orderId,
        amount: total,
        name:   `${form.shippingAddress.firstName} ${form.shippingAddress.lastName}`,
        email:  form.email,
        phone:  form.shippingAddress.phone,
        onSuccess: async (_response: any) => {
          await firestoreService.createOrder(orderData);
          dispatch(clearCart());
          navigate('/order-success', { state: { order: orderData } });
        },
        onDismiss: () => setLoading(false),
      });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  /* ── Order Summary Panel ── */
  const OrderSummary = () => (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <div key={it.productId} className="flex items-center gap-3">
          <div className="relative w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
            <FiShoppingBag size={20} className="text-gray-400" />
            <span className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {it.qty}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{it.title}</p>
          </div>
          <p className="text-sm font-semibold text-gray-800">${(it.price * it.qty).toFixed(2)}</p>
        </div>
      ))}
      <div className="border-t border-gray-200 pt-3 flex flex-col gap-1.5">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Shipping</span>
          <span className="text-green-600 font-medium">Free</span>
        </div>
        <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
          <span>Total</span>
          <span className="text-indigo-600">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Mobile: collapsible order summary bar ── */}
      <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
        <button
          onClick={() => setSummaryOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-indigo-600"
        >
          <span className="flex items-center gap-2">
            <FiShoppingBag size={16} />
            {summaryOpen ? 'Hide' : 'Show'} order summary
            {summaryOpen ? <FiChevronUp size={15} /> : <FiChevronDown size={15} />}
          </span>
          <span className="text-gray-900 font-bold">${total.toFixed(2)}</span>
        </button>
        {summaryOpen && (
          <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
            <OrderSummary />
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 lg:grid lg:grid-cols-[1fr_420px] lg:gap-12">

        {/* ══ LEFT: Form ══ */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">

          {/* Contact */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Contact</h2>
              {!user && <a href="/auth" className="text-sm text-indigo-600 hover:underline font-medium">Sign in</a>}
            </div>
            <div className="flex flex-col gap-3">
              <Field
                label="Email" id="email" type="email" placeholder="you@example.com"
                error={errors.email?.message}
                registration={register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                })}
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" {...register('emailOffers')} className="w-4 h-4 rounded border-gray-300 accent-indigo-500" />
                Email me with news and offers
              </label>
            </div>
          </section>

          {/* Delivery */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Delivery</h2>
            <div className="flex flex-col gap-3">
              <AddressSection prefix="shippingAddress" register={register} errors={errors} />

              <div className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" {...register('saveInfo')} className="w-4 h-4 rounded border-gray-300 accent-indigo-500" />
                  Save this information for next time
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" {...register('textOffers')} className="w-4 h-4 rounded border-gray-300 accent-indigo-500" />
                  Text me with news and offers
                </label>
              </div>
            </div>
          </section>

          {/* Shipping method */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Shipping method</h2>
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 text-sm text-gray-500">
              {shippingAddress && shippingState
                ? <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-medium">Standard Delivery (5–7 days)</span>
                    <span className="text-green-600 font-semibold">Free</span>
                  </div>
                : 'Enter your shipping address to view available shipping methods.'}
            </div>
          </section>

          {/* Payment */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Payment</h2>
            <p className="text-xs text-gray-500 mb-3 flex items-center gap-1"><FiLock size={11} /> All transactions are secure and encrypted.</p>
            <div className="border-2 border-indigo-400 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-indigo-50">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-500 bg-indigo-500 flex items-center justify-center">
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

          {/* Billing address */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Billing address</h2>
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {(['same', 'different'] as const).map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    billingOption === opt ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    billingOption === opt ? 'border-indigo-500' : 'border-gray-400'
                  }`}>
                    {billingOption === opt && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                  </div>
                  <input type="radio" value={opt} {...register('billingOption')} className="sr-only" />
                  <span className="text-sm text-gray-700">
                    {opt === 'same' ? 'Same as shipping address' : 'Use a different billing address'}
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* Billing address – expanded fields when 'different' */}
          {billingOption === 'different' && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">Billing address</h2>
              <AddressSection prefix="billingAddress" register={register} errors={errors} />
            </section>
          )}

          {/* Pay Now */}
          <button
            type="submit"
            disabled={loading || items.length === 0}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <FiLock size={16} />
            {loading ? 'Processing…' : 'Pay now'}
          </button>

          {/* Footer links */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-8">
            {['Refund policy', 'Shipping policy', 'Privacy policy', 'Terms of service'].map((l) => (
              <button type="button" key={l} className="hover:text-indigo-500 transition-colors">{l}</button>
            ))}
          </div>
        </form>

        {/* ══ RIGHT: Order Summary (desktop only) ══ */}
        <aside className="hidden lg:flex flex-col gap-6 border-l border-gray-200 pl-10 pt-2">
          <h3 className="text-base font-bold text-gray-800">Order Summary</h3>
          <OrderSummary />
        </aside>
      </div>
    </div>
  );
}
