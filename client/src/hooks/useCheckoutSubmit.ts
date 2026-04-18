import { useState } from 'react';
import { useAppDispatch } from '../store/hooks';
import { clearCart, removeFromCart } from '../store/cartSlice';
import { useNavigate } from 'react-router-dom';
import { paymentsApi, ordersApi } from '../services/apiClient';
import { initRazorpayPayment } from '../services/paymentService';
import { generateOrderId } from '../utils/generateOrderId';
import { type CheckoutFormState, type CartItem } from '../utils/types';
import {
  type CreateOrderPayload,
  type AddressPayload,
  ApiError,
  getErrorMessage,
  type StockValidationIssue,
} from '../utils/apiTypes';

// ── Mock payment mode (commented out — real Razorpay is active) ──────────────
// const USE_MOCK_PAYMENT = process.env.REACT_APP_USE_MOCK_PAYMENT !== 'false';
//
// type MockPayCtx = {
//   orderId: string;
//   orderData: any;
//   amount: number;
//   name: string;
//   email: string;
//   phone: string;
// };

type Params = {
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  total: number;
  isBuyNow: boolean;
  buyNowItem: CartItem | null;
  navigatedAway: React.MutableRefObject<boolean>;
};

export function useCheckoutSubmit({
  items, subtotal, taxAmount, shippingFee, total,
  isBuyNow, buyNowItem, navigatedAway,
}: Params) {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();

  const [loading,      setLoading]      = useState(false);
  const [payError,     setPayError]     = useState<string | null>(null);
  // const [mockPayCtx,   setMockPayCtx]   = useState<MockPayCtx | null>(null);  // mock payment commented out
  const [stockIssues,  setStockIssues]  = useState<StockValidationIssue[] | null>(null);

  const clearOrderedItems = () => {
    if (isBuyNow && buyNowItem) {
      dispatch(removeFromCart({ productId: buyNowItem.productId, size: buyNowItem.size ?? null }));
    } else {
      dispatch(clearCart());
    }
  };

  const onSubmit = async (form: CheckoutFormState) => {
    setPayError(null);
    setLoading(true);
    try {
      const orderId    = generateOrderId();
      const addressSame = form.billingOptionSame;

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
          size:      i.size ?? null,
        })),
        totalAmount: +total.toFixed(2),
      };

      const displayOrder = {
        ...orderPayload,
        subtotal,
        taxAmount,
        shippingFee,
        items: items.map((i) => ({
          productId: i.productId,
          title:     i.title,
          qty:       i.qty,
          size:      i.size ?? null,
          unitPrice: i.price,
          total:     parseFloat((i.price * i.qty).toFixed(2)),
        })),
      };

      // Step 1 — persist order
      let serverTotal: number = total;
      try {
        const created = await ordersApi.create(orderPayload);
        if (typeof created.totalAmount === 'number') serverTotal = created.totalAmount;
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

      // ── Mock payment mode (commented out — real Razorpay is active) ──────
      // if (USE_MOCK_PAYMENT) {
      //   setMockPayCtx({
      //     orderId,
      //     orderData: displayOrder,
      //     amount: serverTotal,
      //     name:  `${form.shippingAddress.firstName} ${form.shippingAddress.lastName}`,
      //     email: form.email,
      //     phone: form.shippingAddress.phone,
      //   });
      //   setLoading(false);
      //   return;
      // }

      // Step 2 — create Razorpay server order
      // keyId is returned by the backend so it never needs to be hardcoded in the frontend
      let razorpayOrderId: string | undefined;
      let confirmedAmount = serverTotal;
      let razorpayKeyId   = '';
      try {
        const rzpOrder = await paymentsApi.createRazorpayOrder({ orderId });
        razorpayOrderId = rzpOrder.razorpayOrderId;
        razorpayKeyId   = rzpOrder.keyId;
        if (typeof rzpOrder.amount === 'number') confirmedAmount = rzpOrder.amount / 100;
      } catch (err) {
        setPayError(getErrorMessage(err, 'Payment setup failed. Please try again or contact support.'));
        setLoading(false);
        return;
      }

      if (!razorpayKeyId) {
        setPayError('Payment gateway is not configured. Please contact support.');
        setLoading(false);
        return;
      }

      // Step 3 — Razorpay checkout
      await initRazorpayPayment({
        orderId,
        amount: confirmedAmount,
        name:   `${form.shippingAddress.firstName} ${form.shippingAddress.lastName}`,
        email:  form.email,
        phone:  form.shippingAddress.phone,
        keyId:  razorpayKeyId,
        razorpayOrderId,

        onSuccess: async (response: any) => {
          try {
            await paymentsApi.verifyPayment({
              orderId,
              razorpay_order_id:    response.razorpay_order_id,
              razorpay_payment_id:  response.razorpay_payment_id,
              razorpay_signature:   response.razorpay_signature,
            });
          } catch (err) {
            console.error('Payment verification failed after collection:', err);
            localStorage.setItem('pendingOrder', JSON.stringify({
              ...orderPayload,
              paymentId: response.razorpay_payment_id,
              verifyFailedAt: new Date().toISOString(),
            }));
            navigatedAway.current = true;
            navigate('/order-success', {
              state: { order: displayOrder, paymentId: response.razorpay_payment_id, paymentMethod: 'Razorpay', verifyFailed: true },
            });
            clearOrderedItems();
            return;
          }
          navigatedAway.current = true;
          navigate('/order-success', {
            state: { order: displayOrder, paymentId: response.razorpay_payment_id, paymentMethod: 'Razorpay' },
          });
          clearOrderedItems();
        },

        onDismiss: async () => {
          try {
            await paymentsApi.failPayment({ orderId, reason: 'payment_dismissed' });
          } catch (err) {
            console.warn('Could not mark order cancelled:', getErrorMessage(err));
          }
          navigatedAway.current = true;
          navigate('/order-failure', {
            state: { order: displayOrder, reason: 'payment_dismissed', description: 'Payment was cancelled.' },
          });
        },

        onPaymentFailed: async (error) => {
          console.error('Razorpay payment failed:', error);
          try {
            await paymentsApi.failPayment({ orderId, reason: 'payment_failed' });
          } catch (err) {
            console.warn('Could not mark order as payment_failed:', getErrorMessage(err));
          }
          navigatedAway.current = true;
          navigate('/order-failure', {
            state: { order: displayOrder, reason: 'payment_failed', description: error.description, errorCode: error.reason },
          });
        },
      });
    } catch (err) {
      console.error('Checkout error:', err);
      setPayError(getErrorMessage(err));
      setLoading(false);
    }
  };

  // ── Mock payment handlers (commented out — real Razorpay is active) ────────
  // const handleMockSuccess = async (response: any) => {
  //   const ctx = mockPayCtx!;
  //   setMockPayCtx(null);
  //   setLoading(true);
  //   try {
  //     await paymentsApi.record({
  //       paymentId:         response.razorpay_payment_id,
  //       orderId:           ctx.orderId,
  //       razorpayOrderId:   response.razorpay_order_id,
  //       razorpaySignature: response.razorpay_signature,
  //       transactionRef:    response.transactionRef ?? null,
  //       utr:               response.utr ?? null,
  //       currency:          'INR',
  //       method:            'mock',
  //       cardLast4:         response.cardLast4 ?? null,
  //       cardNetwork:       response.cardNetwork ?? null,
  //       customerName:      ctx.name,
  //       customerEmail:     ctx.email,
  //       isTest:            true,
  //     });
  //   } catch (err) {
  //     console.warn('Could not record payment ledger entry:', err);
  //   }
  //   navigatedAway.current = true;
  //   navigate('/order-success', {
  //     state: {
  //       order:         ctx.orderData,
  //       paymentId:     response.razorpay_payment_id,
  //       paymentMethod: response.cardNetwork ? `Mock · ${response.cardNetwork}` : 'Mock Payment',
  //     },
  //   });
  //   clearOrderedItems();
  //   setLoading(false);
  // };
  //
  // const handleMockDismiss = async () => {
  //   const ctx = mockPayCtx!;
  //   setMockPayCtx(null);
  //   try { await paymentsApi.failPayment({ orderId: ctx.orderId, reason: 'payment_dismissed' }); } catch { /* ignore */ }
  //   navigatedAway.current = true;
  //   navigate('/order-failure', {
  //     state: { order: ctx.orderData, reason: 'payment_dismissed', description: 'Payment was cancelled by the user.' },
  //   });
  // };
  //
  // const handleMockFailed = (error: { description: string; reason: string }) => {
  //   const ctx = mockPayCtx!;
  //   setMockPayCtx(null);
  //   paymentsApi.failPayment({ orderId: ctx.orderId, reason: 'payment_failed' }).catch(() => {});
  //   navigatedAway.current = true;
  //   navigate('/order-failure', {
  //     state: { order: ctx.orderData, reason: 'payment_failed', description: error.description, errorCode: error.reason },
  //   });
  // };

  return {
    loading, payError, setPayError,
    stockIssues, setStockIssues,
    onSubmit,
  };
}
