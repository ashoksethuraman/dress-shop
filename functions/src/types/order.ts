import type {OrderStatus} from "./enums";

export interface AddressDto {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
}

export interface OrderItemInput {
  productId: string;
  title: string;
  qty: number;
  size?: string | null;
}

export interface CreateOrderBody {
  id?: string;
  contactEmail: string;
  billingAddress: AddressDto;
  shippingAddress?: AddressDto;
  billingAndShippingSame: boolean;
  items: OrderItemInput[];
  totalAmount?: number; // optional — used only for tamper-detection, server always recomputes
}

export interface VerifyPaymentBody {
  orderId: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_order_id?: string;
}

export interface FailPaymentBody {
  orderId: string;
  reason?: "payment_dismissed" | "payment_failed";
}

export interface CreateRazorpayOrderBody {
  orderId: string; // amount removed — always read from stored Firestore order
}

export interface RecordPaymentBody {
  paymentId: string;
  orderId: string;
  provider?: string;
  razorpayOrderId?: string | null;
  razorpaySignature?: string | null;
  currency?: string;
  method?: string | null;
  transactionRef?: string | null;
  utr?: string | null;
  cardLast4?: string | null;
  cardNetwork?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  isTest?: boolean;
}

export interface UpdateOrderStatusBody {
  orderId: string;
  status: OrderStatus;
}

export interface RefundOrderBody {
  orderId: string;
  reason?: string;  // optional admin note
}
