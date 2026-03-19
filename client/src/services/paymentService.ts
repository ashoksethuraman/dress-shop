/**
 * Razorpay payment integration.
 *
 * TO ENABLE:
 *  1. Replace RAZORPAY_KEY_ID below with your actual Razorpay Key ID.
 *  2. Optionally call your backend to create a Razorpay order and pass the
 *     returned `order_id` as `razorpayOrderId` in initRazorpayPayment().
 *     (Without a backend order_id, payments still open in test mode.)
 */

// ── Put your Razorpay Key ID here ──────────────────────────
export const RAZORPAY_KEY_ID = 'rzp_test_XXXXXXXXXXXXXXXX';
// ───────────────────────────────────────────────────────────

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayPaymentOptions {
  orderId: string;           // your internal order id
  amount: number;            // amount in USD/INR (will be converted to paise)
  name: string;              // customer name
  email: string;             // customer email
  phone: string;             // customer phone
  razorpayOrderId?: string;  // optional: Razorpay order_id from backend
  onSuccess: (response: any) => void;
  onDismiss: () => void;
}

export async function initRazorpayPayment(opts: RazorpayPaymentOptions): Promise<void> {
  if (!window.Razorpay) {
    alert('Razorpay SDK not loaded. Please refresh the page and try again.');
    opts.onDismiss();
    return;
  }

  const amountInPaise = Math.round(opts.amount * 100); // Razorpay expects smallest currency unit

  const options = {
    key:         RAZORPAY_KEY_ID,
    amount:      amountInPaise,
    currency:    'INR',
    name:        'Dress Shop',
    description: `Order #${opts.orderId}`,
    order_id:    opts.razorpayOrderId ?? undefined, // omit if no backend order
    prefill: {
      name:    opts.name,
      email:   opts.email,
      contact: opts.phone,
    },
    theme: {
      color: '#6366f1', // indigo-500
    },
    handler: (response: any) => {
      opts.onSuccess(response);
    },
    modal: {
      ondismiss: () => {
        opts.onDismiss();
      },
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
}

