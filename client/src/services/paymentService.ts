/**
 * Razorpay payment integration.
 *
 * TO ENABLE:
 *  1. Replace RAZORPAY_KEY_ID below with your actual Razorpay Key ID.
 *  2. Optionally call your backend to create a Razorpay order and pass the
 *     returned `order_id` as `razorpayOrderId` in initRazorpayPayment().
 *     (Without a backend order_id, payments still open in test mode.)
 */

// ── Razorpay Key ID — set REACT_APP_RAZORPAY_KEY_ID in your .env file ──────
export const RAZORPAY_KEY_ID =
  process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_XXXXXXXXXXXXXXXX';
// ───────────────────────────────────────────────────────────────────────────

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
  onDismiss: () => void;        // user closed the modal without paying
  onPaymentFailed?: (error: { code: string; description: string; reason: string }) => void; // card declined / bank error
}

let scriptPromise: Promise<void> | null = null;

/** Call this when the checkout page mounts to preload the SDK in the background. */
export function preloadRazorpayScript(): void {
  if (!scriptPromise) scriptPromise = loadRazorpayScript();
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
}

export async function initRazorpayPayment(opts: RazorpayPaymentOptions): Promise<void> {
  try {
    // reuse the in-flight promise started by preloadRazorpayScript(), or start fresh
    await (scriptPromise ?? (scriptPromise = loadRazorpayScript()));
  } catch {
    alert('Razorpay SDK failed to load. Please check your connection and try again.');
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

  // payment.failed fires for card-declined / bank errors (distinct from modal dismiss)
  rzp.on('payment.failed', (response: any) => {
    const err = response?.error ?? {};
    opts.onPaymentFailed?.({
      code:        err.code        ?? 'PAYMENT_FAILED',
      description: err.description ?? 'Payment failed.',
      reason:      err.reason      ?? 'unknown',
    });
  });

  rzp.open();
}

