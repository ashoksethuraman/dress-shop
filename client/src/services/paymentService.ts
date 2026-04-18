// RAZORPAY_KEY_ID is no longer stored on the frontend.
// The backend returns the public keyId in the /payments/razorpay-order response
// and the secret NEVER leaves the server (functions/.env → RAZORPAY_KEY_SECRET).
// export const RAZORPAY_KEY_ID =
//   process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_XXXXXXXXXXXXXXXX';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayPaymentOptions {
  orderId: string;
  amount: number;
  name: string;
  email: string;
  phone: string;
  keyId: string;           // received from backend — never hardcode here
  razorpayOrderId?: string;
  onSuccess: (response: any) => void;
  onDismiss: () => void;
  onPaymentFailed?: (error: { code: string; description: string; reason: string }) => void;
}

let scriptPromise: Promise<void> | null = null;

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
    await (scriptPromise ?? (scriptPromise = loadRazorpayScript()));
  } catch {
    alert('Razorpay SDK failed to load. Please check your connection and try again.');
    opts.onDismiss();
    return;
  }

  const amountInPaise = Math.round(opts.amount * 100);

  const options = {
    key:         opts.keyId,
    amount:      amountInPaise,
    currency:    'INR',
    name:        'Dress Shop',
    description: `Order #${opts.orderId}`,
    order_id:    opts.razorpayOrderId ?? undefined,
    prefill: {
      name:    opts.name,
      email:   opts.email,
      contact: opts.phone,
    },
    theme: {
      color: '#6366f1',
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

