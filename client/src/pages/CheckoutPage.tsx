import React, { useEffect, useRef } from 'react';
import { useAppSelector } from '../store/hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { FiArrowLeft } from 'react-icons/fi';
import { preloadRazorpayScript, getRazorpayLoadError, retryRazorpayScript } from '../services/paymentService';
import { CheckoutFormState } from '../utils/types';
import { type StockValidationIssue } from '../utils/apiTypes';
import BillingAddressSection from '../components/checkout/BillingAddressSection';
import OrderSummaryPanel from '../components/checkout/OrderSummaryPanel';
import ContactSection from '../components/checkout/ContactSection';
import DeliverySection from '../components/checkout/DeliverySection';
import ShippingMethodSection from '../components/checkout/ShippingMethodSection';
import PaymentSection from '../components/checkout/PaymentSection';
import MobileOrderSummaryBar from '../components/checkout/MobileOrderSummaryBar';
// import MockPaymentModal from '../components/MockPaymentModal';  // mock payment commented out
import AlertModal from '../components/AlertModal';
import { loadCheckoutForm, saveCheckoutForm } from '../services/guestSession';
import { calcOrderTotals } from '../utils/priceLevel';
import { useCheckoutSubmit } from '../hooks/useCheckoutSubmit';

// const USE_MOCK_PAYMENT = process.env.REACT_APP_USE_MOCK_PAYMENT !== 'false';  // mock payment commented out

const EMPTY_ADDRESS = {
  firstName: '', lastName: '', company: '', address: '',
  apartment: '', city: '', state: '', pinCode: '', phone: '',
};

type LegacySavedCheckoutForm = Partial<CheckoutFormState> & { billingOption?: 'same' | 'different' };

export default function CheckoutPage() {
  const cartItems = useAppSelector((s) => s.cart.items);
  const user      = useAppSelector((s) => s.user.user);
  const navigate  = useNavigate();
  const location  = useLocation();

  const buyNowItem = (location.state as { buyNowItem?: any } | null)?.buyNowItem ?? null;
  const isBuyNow   = buyNowItem !== null;
  const items      = isBuyNow ? [buyNowItem] : cartItems;

  const subtotal = items.reduce((s: number, i: any) => s + i.price * i.qty, 0);
  const { taxAmount, shippingFee, totalAmount: total } = calcOrderTotals(subtotal);

  const navigatedAway = useRef(false);
  const [sdkError, setSdkError] = React.useState<string | null>(null);
  const [retryingSDK, setRetryingSDK] = React.useState(false);

  useEffect(() => {
    if (!navigatedAway.current && !isBuyNow && items.length === 0) navigate('/', { replace: true });
  }, [items.length, isBuyNow, navigate]);

  useEffect(() => {
    preloadRazorpayScript().catch(() => {
      const error = getRazorpayLoadError();
      setSdkError(error?.message || 'Failed to load payment gateway');
    });
  }, []);  // always preload (mock payment disabled)

  const handleRetrySDK = async () => {
    setRetryingSDK(true);
    setSdkError(null);
    try {
      await retryRazorpayScript();
      setRetryingSDK(false);
    } catch {
      const error = getRazorpayLoadError();
      setSdkError(error?.message || 'Failed to load payment gateway');
      setRetryingSDK(false);
    }
  };

  const {
    loading, payError, setPayError,
    stockIssues, setStockIssues,
    onSubmit,
    // mockPayCtx, handleMockSuccess, handleMockDismiss, handleMockFailed,  // mock payment commented out
  } = useCheckoutSubmit({ items, subtotal, taxAmount, shippingFee, total, isBuyNow, buyNowItem, navigatedAway });

  const savedForm = loadCheckoutForm() as LegacySavedCheckoutForm | null;
  const billingOptionSame = typeof savedForm?.billingOptionSame === 'boolean'
    ? savedForm.billingOptionSame
    : savedForm?.billingOption !== 'different';

  const { register, handleSubmit, watch, control, formState: { errors }, clearErrors } = useForm<CheckoutFormState>({
    defaultValues: {
      shippingAddress: { ...EMPTY_ADDRESS, ...(savedForm?.shippingAddress ?? {}) },
      billingAddress:  { ...EMPTY_ADDRESS, ...(savedForm?.billingAddress  ?? {}) },
      billingOptionSame,
      emailOffers: false, saveInfo: false, textOffers: false,
      ...(savedForm ?? {}),
    },
  });

  const shippingAddress = useWatch({ control, name: 'shippingAddress.address' as any, defaultValue: '' });
  const shippingState   = useWatch({ control, name: 'shippingAddress.state'   as any, defaultValue: '' });

  useEffect(() => {
    const { unsubscribe } = watch((values) => {
      saveCheckoutForm({
        email:             values.email,
        shippingAddress:   values.shippingAddress as any,
        billingAddress:    values.billingAddress  as any,
        billingOptionSame: values.billingOptionSame,
      });
    });
    return () => unsubscribe();
  }, [watch]);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-20">

      {/* Razorpay SDK loading error modal */}
      {sdkError && (
        <AlertModal
          type="error"
          title="Unable to Load Payment Gateway"
          messages={[
            'The payment system failed to load. This may be caused by:',
            'Network connectivity issues or slow internet connection',
            'Ad blockers or browser extensions blocking payment scripts',
            'Firewall or security software restrictions',
            'Please try the following:',
            '1. Check your internet connection',
            '2. Disable ad blockers or browser extensions temporarily',
            '3. Try refreshing the page or clicking "Retry" below',
          ]}
          onClose={() => setSdkError(null)}
          actionLabel={retryingSDK ? "Retrying..." : "Retry Loading"}
          onAction={retryingSDK ? undefined : handleRetrySDK}
          actionIcon={null}
          actionVariant="primary"
        />
      )}

      {/* Stock validation modal */}
      {stockIssues && (
        <AlertModal
          type="warning"
          title="Some items in your cart are unavailable"
          messages={(stockIssues as StockValidationIssue[]).map((i) => {
            const s = i.size ? ` (Size ${i.size})` : i.ageSize ? ` (Age ${i.ageSize} years)` : '';
            if (i.reason === 'not_found')           return `"${i.title}"${s} is no longer available — please remove it from your cart.`;
            if (i.reason === 'size_unavailable')    return `"${i.title}"${s} is not available anymore — please choose another size.`;
            if (i.reason === 'insufficient_stock')  return `"${i.title}"${s} has only ${i.availableQty ?? 0} left, but your cart has ${i.requestedQty ?? 0}.`;
            return `"${i.title}"${s} is out of stock — please update your cart.`;
          })}
          onClose={() => setStockIssues(null)}
          actionLabel="Go to Cart"
          onAction={() => { setStockIssues(null); navigate('/cart'); }}
        />
      )}

      {/* Mock payment modal — commented out (real Razorpay is active) */}
      {/* {mockPayCtx && (
        <MockPaymentModal
          orderId={mockPayCtx.orderId}
          amount={mockPayCtx.amount}
          name={mockPayCtx.name}
          email={mockPayCtx.email}
          onSuccess={handleMockSuccess}
          onDismiss={handleMockDismiss}
          onPaymentFailed={handleMockFailed}
        />
      )} */}

      {/* Mobile order summary bar */}
      <MobileOrderSummaryBar
        items={items}
        subtotal={subtotal}
        taxAmount={taxAmount}
        shippingFee={shippingFee}
        total={total}
      />

      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-8 lg:grid lg:grid-cols-[1fr_420px] lg:gap-12">

        {/* LEFT: form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">

          {payError && (
            <AlertModal
              type="error"
              title="Payment Error"
              messages={[payError]}
              onClose={() => setPayError(null)}
            />
          )}

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-brand-dark hover:text-brand-hover font-medium transition-colors self-start"
          >
            <FiArrowLeft size={15} /> {isBuyNow ? 'Back to order summary' : 'Back to cart'}
          </button>

          <ContactSection register={register} errors={errors} user={user} />
          <DeliverySection register={register} errors={errors} />
          <ShippingMethodSection hasAddress={!!(shippingAddress && shippingState)} />
          <BillingAddressSection control={control} register={register} errors={errors} clearErrors={clearErrors} />
          <PaymentSection loading={loading} disabled={loading || items.length === 0} />
        </form>

        {/* RIGHT: order summary (desktop) */}
        <aside className="hidden lg:flex flex-col py-2 gap-6 border-l border-gray-200 pl-10 pt-2 lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
          <h3 className="text-base font-bold text-gray-800">Order Summary</h3>
          <OrderSummaryPanel
            items={items}
            subtotal={subtotal}
            taxAmount={taxAmount}
            shippingFee={shippingFee}
            total={total}
          />
        </aside>
      </div>
    </div>
  );
}


