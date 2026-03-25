/**
 * apiClient — fetch wrapper that automatically attaches the Firebase
 * ID token as "Authorization: Bearer <token>" on every request.
 *
 * Named helpers map 1-to-1 with the deployed Cloud Functions.
 * All request/response shapes are imported from ../utils/apiTypes.ts which
 * mirrors the backend contracts in functions/src/schemas.ts.
 */

import { authService } from './authService';
import {
  ApiError,
  type CreateOrderPayload,
  type CreateOrderResponse,
  type VerifyPaymentPayload,
  type VerifyPaymentResponse,
  type FailPaymentPayload,
  type CreateRazorpayOrderPayload,
  type CreateRazorpayOrderResponse,
  type RecordPaymentPayload,
  type RecordPaymentResponse,
  type UpdateOrderStatusPayload,
  type StoredOrder,
  type TrackOrderResponse,
} from '../utils/apiTypes';

export type { ApiError };

const BASE =
  process.env.REACT_APP_FUNCTIONS_BASE_URL ||
  `https://asia-south1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net`;

async function buildHeaders(extra: HeadersInit = {}): Promise<HeadersInit> {
  const token = await authService.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/**
 * Core fetch wrapper.
 * On non-2xx responses, parses the server's `{ error, field? }` JSON and
 * throws an `ApiError` so callers always get a human-readable message.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE}/${path}`;
  const headers = await buildHeaders(options.headers as HeadersInit);
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const text = await res.text();
    let message = `Request failed (${res.status}).`;
    let field: string | undefined;
    let body: Record<string, any> | undefined;
    try {
      const json = JSON.parse(text) as { error?: string; field?: string; [k: string]: unknown };
      if (json.error) { message = json.error as string; field = json.field as string | undefined; }
      body = json as Record<string, any>;
    } catch { /* raw text is not JSON — keep generic message */ }
    throw new ApiError(res.status, message, field, body);
  }

  return res.status === 204 ? (null as unknown as T) : (res.json() as Promise<T>);
}

// ── Low-level helpers ──────────────────────────────────────────────────────
export const apiClient = {
  get:    <T>(path: string)                  => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)   => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
};

// ── Products ───────────────────────────────────────────────────────────────

type ProductFields = {
  title: string; description?: string; price: number;
  category?: 'men' | 'women'; images?: string[]; sizes?: string[];
  stock?: 'available' | 'out_of_stock';
};

export const productsApi = {
  /** GET /apiGetProducts — public */
  list: () => apiClient.get<{ products: unknown[] }>('apiGetProducts'),

  /** GET /apiGetProductById?id=<id> — public */
  getById: (id: string) => apiClient.get<unknown>(`apiGetProductById?id=${encodeURIComponent(id)}`),

  /** POST /apiAddProduct — admin only */
  add: (product: ProductFields) =>
    apiClient.post<{ id: string }>('apiAddProduct', product),

  /** PUT /apiUpdateProduct?id=<id> — admin only */
  update: (id: string, fields: Partial<ProductFields>) =>
    apiClient.put<{ success: boolean }>(`apiUpdateProduct?id=${encodeURIComponent(id)}`, fields),

  /** DELETE /apiDeleteProduct?id=<id> — admin only */
  delete: (id: string) =>
    apiClient.delete<{ success: boolean }>(`apiDeleteProduct?id=${encodeURIComponent(id)}`),
};

// ── Orders ─────────────────────────────────────────────────────────────────
export const ordersApi = {
  /** POST /apiCreateOrder — guest-friendly */
  create: (order: CreateOrderPayload) =>
    apiClient.post<CreateOrderResponse>('apiCreateOrder', order),

  /** GET /apiGetMyOrders — authenticated */
  mine: () => apiClient.get<{ orders: StoredOrder[] }>('apiGetMyOrders'),

  /** GET /apiGetAllOrders — admin only; cursor-based pagination */
  all: (params?: { limit?: number; lastDocId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit)     qs.set('limit',     String(params.limit));
    if (params?.lastDocId) qs.set('lastDocId',  params.lastDocId);
    if (params?.status)    qs.set('status',     params.status);
    const query = qs.toString();
    return apiClient.get<{ orders: StoredOrder[]; hasMore: boolean }>(
      `apiGetAllOrders${query ? `?${query}` : ''}`,
    );
  },

  /** GET /apiGetOrderById?id=<id> — authenticated */
  getById: (id: string) =>
    apiClient.get<StoredOrder>(`apiGetOrderById?id=${encodeURIComponent(id)}`),

  /** POST /apiUpdateOrderStatus — admin only */
  updateStatus: (payload: UpdateOrderStatusPayload) =>
    apiClient.post<{ success: boolean }>('apiUpdateOrderStatus', payload),

  /** GET /apiTrackOrder?id=<id> — public, no auth required */
  track: (id: string) =>
    apiClient.get<TrackOrderResponse>(`apiTrackOrder?id=${encodeURIComponent(id)}`),
};

// ── Payments ───────────────────────────────────────────────────────────────
export const paymentsApi = {
  /**
   * POST /apiCreateRazorpayOrder
   * Creates a server-side Razorpay order and returns the razorpayOrderId.
   * Pass the returned id to initRazorpayPayment() as `razorpayOrderId`.
   */
  createRazorpayOrder: (payload: CreateRazorpayOrderPayload) =>
    apiClient.post<CreateRazorpayOrderResponse>('apiCreateRazorpayOrder', payload),

  /**
   * POST /apiVerifyPayment
   * Verifies Razorpay HMAC signature and marks the order CONFIRMED in Firestore.
   */
  verifyPayment: (payload: VerifyPaymentPayload) =>
    apiClient.post<VerifyPaymentResponse>('apiVerifyPayment', payload),

  /**
   * POST /apiFailPayment
   * Marks an order as CANCELLED or PAYMENT_FAILED when the gateway is
   * dismissed or returns an error.
   */
  failPayment: (payload: FailPaymentPayload) =>
    apiClient.post<{ success: boolean }>('apiFailPayment', payload),

  /**
   * POST /apiRecordPayment
   * Writes a payment ledger record used by mock/test mode.
   * In production, apiVerifyPayment handles this automatically.
   * Security: never pass full PAN, CVV, or full card numbers.
   */
  record: (payload: RecordPaymentPayload) =>
    apiClient.post<RecordPaymentResponse>('apiRecordPayment', payload),
};
