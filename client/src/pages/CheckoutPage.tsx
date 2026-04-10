import React, { useEffect, useRef, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { clearCart } from '../store/cartSlice';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { generateOrderId } from '../utils/generateOrderId';
import { paymentsApi, ordersApi } from '../services/apiClient'; // backend
// import { firestorePaymentsApi as paymentsApi, firestoreOrdersApi as ordersApi } from '../services/firestoreClient'; // direct firestore
import { initRazorpayPayment, preloadRazorpayScript } from '../services/paymentService';
import { FiChevronDown, FiChevronUp, FiLock, FiShoppingBag, FiArrowLeft } from 'react-icons/fi';
import { CheckoutFormState } from '../utils/types';
import { type CreateOrderPayload, type AddressPayload, getErrorMessage, ApiError, type StockValidationIssue } from '../utils/apiTypes';
import AddressSection from '../components/AddressSection';
import FormField from '../components/FormField';
import MockPaymentModal from '../components/MockPaymentModal';
import { loadCheckoutForm, saveCheckoutForm } from '../services/guestSession';
import AlertModal from '../components/AlertModal';

/**
 * Flip to `false` and re-enable the Razorpay block below when payment integration is ready.
 * In mock mode a local dialog simulates success / failure without any real gateway.
 */
const USE_MOCK_PAYMENT = true;

/* ─── Main Component ─────────────────────────────────────── */
export default function CheckoutPage() {
  const items    = useAppSelector((s) => s.cart.items);
  const user     = useAppSelector((s) => s.user.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const total    = subtotal; // free shipping

  // Redirect to home if cart is empty
  useEffect(() => {
    if (!navigatedAway.current && items.length === 0) navigate('/', { replace: true });
  }, [items.length, navigate]);

  // Preload Razorpay SDK only when NOT in mock mode
  useEffect(() => { if (!USE_MOCK_PAYMENT) preloadRazorpayScript(); }, []);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [payError, setPayError]       = useState<string | null>(null);
  const [mockPayCtx, setMockPayCtx]   = useState<{
    orderId: string; orderData: any;
    amount: number; name: string; email: string; phone: string;
  } | null>(null);
  const [stockIssues, setStockIssues] = useState<StockValidationIssue[] | null>(null);

  // Prevents the "empty cart → go home" redirect from firing after a successful payment navigation
  const navigatedAway = useRef(false);

  // Load any previously saved form data so returning guests don't re-type their address
  const savedForm = loadCheckoutForm();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormState>({
    defaultValues: {
      billingOption: 'same',
      emailOffers: false,
      saveInfo: false,
      textOffers: false,
      ...(savedForm ?? {}),
    },
  });

  const billingOption    = watch('billingOption');
  const shippingAddress  = watch('shippingAddress.address' as any);
  const shippingState    = watch('shippingAddress.state' as any);

  // Persist email, address, and billing option on every change.
  // Address is intentionally kept even after order success so future checkouts are pre-filled.
  useEffect(() => {
    const { unsubscribe } = watch((values) => {
      saveCheckoutForm({
        email:           values.email,
        shippingAddress: values.shippingAddress as any,
        billingAddress:  values.billingAddress as any,
        billingOption:   values.billingOption,
      });
    });
    return () => unsubscribe();
  }, [watch]);

  /* ── Submit ── */
  const onSubmit = async (form: CheckoutFormState) => {
    setPayError(null);
    setLoading(true);
    try {
      // ── End validation ─────────────────────────────────────────────────────

      const orderId     = generateOrderId();
      const addressSame = form.billingOption === 'same';

      // Normalize form address to the AddressPayload schema
      const normalizeAddr = (a: typeof form.shippingAddress): AddressPayload => ({
        name:    `${a.firstName} ${a.lastName}`.trim(),
        line1:   a.address,
        line2:   a.apartment || null,
        city:    a.city,
        state:   a.state,
        pincode: a.pinCode,
        country: 'India',
        phone:   a.phone,
      });

      // When addresses differ: billingAddress = billing form, shippingAddress = shipping form.
      // When same: only billingAddress is stored; shippingAddress is omitted.
      const billingAddr  = normalizeAddr(addressSame ? form.shippingAddress : form.billingAddress!);
      const shippingAddr = addressSame ? undefined : normalizeAddr(form.shippingAddress);

      const orderPayload: CreateOrderPayload = {
        id:                     orderId,
        contactEmail:           form.email,
        billingAddress:         billingAddr,
        ...(shippingAddr ? { shippingAddress: shippingAddr } : {}),
        billingAndShippingSame: addressSame,
        items: items.map((i) => ({
          productId: i.productId,
          title:     i.title,
          qty:       i.qty,
          unitPrice: i.price,
          total:     +(i.price * i.qty).toFixed(2),
          size:      i.size ?? null,
        })),
        subtotal:    +total.toFixed(2),
        taxAmount:   0,
        shippingFee: 0,
        discount:    0,
        totalAmount: +total.toFixed(2),
      };

      // Step 1 — persist order as PLACED/PENDING BEFORE opening payment
      try {
        await ordersApi.create(orderPayload);
      } catch (err) {
        if (err instanceof ApiError && err.status === 422 && err.body?.issues) {
          setStockIssues(err.body.issues as StockValidationIssue[]);
          setLoading(false);
          return;
        }
        setPayError(getErrorMessage(err, 'Could not create your order. Please check your connection and try again.'));
        setLoading(false);
        return;
      }

      // ── Mock payment mode: show the test-payment dialog instead of Razorpay ──
      if (USE_MOCK_PAYMENT) {
        setMockPayCtx({
          orderId,
          orderData: orderPayload,
          amount: total,
          name:  `${form.shippingAddress.firstName} ${form.shippingAddress.lastName}`,
          email: form.email,
          phone: form.shippingAddress.phone,
        });
        setLoading(false);
        return;
      }

      // Step 2 — create a Razorpay order on the server (HMAC-verifiable)
      let razorpayOrderId: string | undefined;
      try {
        const rzpOrder = await paymentsApi.createRazorpayOrder({ amount: total, orderId });
        razorpayOrderId = rzpOrder.razorpayOrderId;
      } catch {
        // Non-critical: proceed without server-side order (test/dev mode)
        console.warn('Could not create Razorpay server order; continuing without HMAC verification.');
      }

      // Step 3 — open Razorpay checkout
      await initRazorpayPayment({
        orderId,
        amount: total,
        name:   `${form.shippingAddress.firstName} ${form.shippingAddress.lastName}`,
        email:  form.email,
        phone:  form.shippingAddress.phone,
        razorpayOrderId,

        // ─ Success: money collected — verify signature and confirm order
        onSuccess: async (response: any) => {
          try {
            await paymentsApi.verifyPayment({
              orderId,
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            });
          } catch (err) {
            // Critical: payment was collected but confirmation failed
            // Save locally so support can reconcile; do NOT block navigation
            console.error('Payment verification failed after collection:', err);
            localStorage.setItem('pendingOrder', JSON.stringify({
              ...orderPayload,
              paymentId: response.razorpay_payment_id,
              verifyFailedAt: new Date().toISOString(),
            }));
            navigatedAway.current = true;
            navigate('/order-success', {
              state: { order: orderPayload, paymentId: response.razorpay_payment_id, paymentMethod: 'Razorpay', verifyFailed: true },
            });
            dispatch(clearCart());
            return;
          }
          navigatedAway.current = true;
          navigate('/order-success', {
            state: { order: orderPayload, paymentId: response.razorpay_payment_id, paymentMethod: 'Razorpay' },
          });
          dispatch(clearCart());
        },

        // ─ Dismiss: user closed the modal without paying
        onDismiss: async () => {
          try {
            await paymentsApi.failPayment({ orderId, reason: 'payment_dismissed' });
          } catch (err) {
            console.warn('Could not mark order cancelled:', getErrorMessage(err));
          }
          navigatedAway.current = true;
          navigate('/order-failure', {
            state: { order: orderPayload, reason: 'payment_dismissed', description: 'Payment was cancelled.' },
          });
        },

        // ─ Payment failed: card declined / bank error (distinct from dismiss)
        onPaymentFailed: async (error) => {
          console.error('Razorpay payment failed:', error);
          try {
            await paymentsApi.failPayment({ orderId, reason: 'payment_failed' });
          } catch (err) {
            console.warn('Could not mark order as payment_failed:', getErrorMessage(err));
          }
          navigatedAway.current = true;
          navigate('/order-failure', {
            state: { order: orderPayload, reason: 'payment_failed', description: error.description, errorCode: error.reason },
          });
        },
      });
    } catch (err) {
      console.error('Checkout error:', err);
      setPayError(getErrorMessage(err));
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
          <p className="text-sm font-semibold text-gray-800">₹{(it.price * it.qty).toFixed(2)}</p>
        </div>
      ))}
      <div className="border-t border-gray-200 pt-3 flex flex-col gap-1.5">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Shipping</span>
          <span className="text-green-600 font-medium">Free</span>
        </div>
        <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
          <span>Total</span>
          <span className="text-indigo-600">₹{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  /* ── Mock-payment callbacks ── */
  const handleMockSuccess = async (response: any) => {
    const ctx = mockPayCtx!;
    setMockPayCtx(null);
    setLoading(true);
    try {
      // Write the full payment ledger record (no card data — PCI-DSS safe)
      await paymentsApi.record({
        paymentId:        response.razorpay_payment_id,
        orderId:          ctx.orderId,
        razorpayOrderId:  response.razorpay_order_id,
        razorpaySignature: response.razorpay_signature,
        transactionRef:   response.transactionRef ?? null,
        utr:              response.utr ?? null,
        amount:           ctx.amount,
        currency:         'INR',
        method:           'mock',
        cardLast4:        response.cardLast4 ?? null,  // last-4 only — never full PAN
        cardNetwork:      response.cardNetwork ?? null,
        customerName:     ctx.name,
        customerEmail:    ctx.email,
        isTest:           true,
      });
    } catch (err) {
      // best-effort — order is already persisted; don't block navigation
      console.warn('Could not record payment ledger entry:', err);
    }
    navigatedAway.current = true;
    navigate('/order-success', {
      state: {
        order:         ctx.orderData,
        paymentId:     response.razorpay_payment_id,
        paymentMethod: response.cardNetwork ? `Mock · ${response.cardNetwork}` : 'Mock Payment',
      },
    });
    dispatch(clearCart());
    setLoading(false);
  };

  const handleMockDismiss = async () => {
    const ctx = mockPayCtx!;
    setMockPayCtx(null);
    try { await paymentsApi.failPayment({ orderId: ctx.orderId, reason: 'payment_dismissed' }); } catch { /* ignore */ }
    navigatedAway.current = true;
    navigate('/order-failure', {
      state: { order: ctx.orderData, reason: 'payment_dismissed', description: 'Payment was cancelled by the user.' },
    });
  };

  const handleMockFailed = (error: { description: string; reason: string }) => {
    const ctx = mockPayCtx!;
    setMockPayCtx(null);
    paymentsApi.failPayment({ orderId: ctx.orderId, reason: 'payment_failed' }).catch(() => {});
    navigatedAway.current = true;
    navigate('/order-failure', {
      state: { order: ctx.orderData, reason: 'payment_failed', description: error.description, errorCode: error.reason },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Stock Validation Modal ── */}
      {stockIssues && (
        <AlertModal
          type="warning"
          title="Some items in your cart are unavailable"
          messages={stockIssues.map((i) => {
            const sizeText = i.size ? ` (Size ${i.size})` : '';
            if (i.reason === 'not_found') {
              return `"${i.title}"${sizeText} is no longer available — please remove it from your cart.`;
            }
            if (i.reason === 'size_unavailable') {
              return `"${i.title}"${sizeText} is not available anymore — please choose another size.`;
            }
            if (i.reason === 'insufficient_stock') {
              return `"${i.title}"${sizeText} has only ${i.availableQty ?? 0} left, but your cart has ${i.requestedQty ?? 0}.`;
            }
            return `"${i.title}"${sizeText} is out of stock — please update your cart.`;
          })}
          onClose={() => setStockIssues(null)}
          actionLabel="Go to Cart"
          onAction={() => { setStockIssues(null); navigate('/cart'); }}
        />
      )}

      {/* ── Mock Payment Modal ── */}
      {mockPayCtx && (
        <MockPaymentModal
          orderId={mockPayCtx.orderId}
          amount={mockPayCtx.amount}
          name={mockPayCtx.name}
          email={mockPayCtx.email}
          onSuccess={handleMockSuccess}
          onDismiss={handleMockDismiss}
          onPaymentFailed={handleMockFailed}
        />
      )}

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
          <span className="text-gray-900 font-bold">₹{total.toFixed(2)}</span>
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

          {/* Payment error banner */}
          {payError && (
            <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="mt-0.5 shrink-0 text-red-500">&#9888;</span>
              <span>{payError}</span>
              <button
                type="button"
                onClick={() => setPayError(null)}
                className="ml-auto shrink-0 text-red-400 hover:text-red-600"
                aria-label="Dismiss error"
              >&#10005;</button>
            </div>
          )}

          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors self-start"
          >
            <FiArrowLeft size={15} /> Back to order summary
          </button>

          {/* Contact */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Contact</h2>
              {!user && <a href="/auth" className="text-sm text-indigo-600 hover:underline font-medium">Sign in</a>}
            </div>
            <div className="flex flex-col gap-3">
              <FormField
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
