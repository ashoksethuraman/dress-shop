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


// SAME imports as your file, no modifications needed

export function useCheckoutSubmit({
  items, subtotal, taxAmount, shippingFee, total,
  isBuyNow, buyNowItem, navigatedAway,
}: Params) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [stockIssues, setStockIssues] = useState<StockValidationIssue[] | null>(null);

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
      const orderId = generateOrderId();
      const addressSame = form.billingOptionSame;

      // If billing address is same as shipping, copy shipping address to billing address
      // This ensures complete data even if billing fields were not filled
      const formData = {
        ...form,
        billingAddress: addressSame ? form.shippingAddress : form.billingAddress!
      };

      const normalizeAddr = (a: typeof form.shippingAddress): AddressPayload => ({
        name: `${a.firstName} ${a.lastName}`.trim(),
        line1: a.address,
        line2: a.apartment || null,
        city: a.city,
        state: a.state,
        pincode: a.pinCode,
        country: "India",
        phone: a.phone,
      });

      const billingAddr = normalizeAddr(
        addressSame ? formData.shippingAddress : formData.billingAddress!
      );
      const shippingAddress = addressSame ? undefined : normalizeAddr(formData.shippingAddress);

      const orderPayload: CreateOrderPayload = {
        id: orderId,
        contactEmail: form.email,
        billingAddress: billingAddr,
        ...(shippingAddress  ? { shippingAddress  } : {}),
        billingAndShippingSame: addressSame,
        items: items.map((i) => ({
          productId: i.productId,
          title: i.title,
          qty: i.qty,
          size: i.size ?? null,
          ageSize: i.ageSize ?? null,
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
          title: i.title,
          qty: i.qty,
          size: i.size ?? null,
          ageSize: i.ageSize ?? null,
          unitPrice: i.price,
          total: parseFloat((i.price * i.qty).toFixed(2)),
        })),
      };

      /* ------------------- STEP 1: CREATE ORDER ------------------ */
      let serverTotal: number = total;
      try {
        const created = await ordersApi.create(orderPayload);
        if (typeof created.totalAmount === "number") serverTotal = created.totalAmount;
      } catch (err) {
        if (err instanceof ApiError && err.status === 422 && err.body?.issues) {
          setStockIssues(err.body.issues as StockValidationIssue[]);
          setLoading(false);
          return;
        }
        setPayError(
          getErrorMessage(err, "Could not create your order. Please try again.")
        );
        setLoading(false);
        return;
      }

      /* ------------------- STEP 2: GET RAZORPAY ORDER ------------------ */
      let razorpayOrderId = "";
      let confirmedAmount = serverTotal;
      let razorpayKeyId = "";

      try {
        const rzpOrder = await paymentsApi.createRazorpayOrder({ orderId });
        razorpayOrderId = rzpOrder.razorpayOrderId;
        razorpayKeyId = rzpOrder.keyId;
        if (typeof rzpOrder.amount === "number") {
          confirmedAmount = rzpOrder.amount / 100;
        }
      } catch (err) {
        setPayError(
          getErrorMessage(err, "Payment setup failed. Please try again.")
        );
        setLoading(false);
        return;
      }

      if (!razorpayKeyId) {
        setPayError("Payment gateway is not configured. Please contact support.");
        setLoading(false);
        return;
      }

      /* ------------------- STEP 3: RAZORPAY POPUP ------------------ */
      try {
        await initRazorpayPayment({
          orderId,
          amount: confirmedAmount,
          name: `${formData.shippingAddress.firstName} ${formData.shippingAddress.lastName}`,
          email: formData.email,
          phone: formData.shippingAddress.phone,
          keyId: razorpayKeyId,
          razorpayOrderId,

          /* SUCCESS (BUT NOT VERIFIED) */
          onSuccess: async (response) => {
            try {
              await paymentsApi.verifyPayment({
                orderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
            } catch (err) {
              // Store for retry (high reliability)
              localStorage.setItem(
                "pendingOrder",
                JSON.stringify({
                  ...orderPayload,
                  paymentId: response.razorpay_payment_id,
                  verifyFailedAt: Date.now(),
                })
              );

              navigatedAway.current = true;
              navigate("/order-success", {
                state: {
                  order: displayOrder,
                  paymentId: response.razorpay_payment_id,
                  paymentMethod: "Razorpay",
                  verifyFailed: true,
                },
              });
              clearOrderedItems();
              return;
            }

            // Verified → finalize
            navigatedAway.current = true;
            navigate("/order-success", {
              state: {
                order: displayOrder,
                paymentId: response.razorpay_payment_id,
                paymentMethod: "Razorpay",
              },
            });
            clearOrderedItems();
          },

          /* USER CLOSED POPUP */
          onDismiss: async () => {
            try {
              await paymentsApi.failPayment({
                orderId,
                reason: "payment_dismissed",
              });
            } catch {}

            navigatedAway.current = true;
            navigate("/order-failure", {
              state: {
                order: displayOrder,
                reason: "payment_dismissed",
                description: "Payment was cancelled.",
              },
            });
          },

          /* PAYMENT FAILED */
          onPaymentFailed: async (error) => {
            try {
              await paymentsApi.failPayment({
                orderId,
                reason: "payment_failed",
              });
            } catch {}

            navigatedAway.current = true;
            navigate("/order-failure", {
              state: {
                order: displayOrder,
                reason: "payment_failed",
                description: error.description,
                errorCode: error.reason,
              },
            });
          },
        });
      } catch (sdkErr) {
        // SDK loading failed
        setPayError(
          'Payment gateway failed to load. Please check your internet connection, disable any ad blockers, and try again.'
        );
        setLoading(false);
        return;
      }
    } catch (err) {
      setPayError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return {
    loading,
    payError,
    setPayError,
    stockIssues,
    setStockIssues,
    onSubmit,
  };
}