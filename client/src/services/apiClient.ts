import { authService } from './authService';
import { loadingBus } from './loadingBus';
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
  type StoredOrder,
  type TrackOrderResponse,
  type OrderStatus,
} from '../utils/apiTypes';

export type { ApiError };

const BASE =
  process.env.REACT_APP_FUNCTIONS_BASE_URL ||
  `https://asia-south1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/api`;

async function buildHeaders(extra: HeadersInit = {}): Promise<HeadersInit> {
  const token = await authService.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE}/${path}`;
  const headers = await buildHeaders(options.headers as HeadersInit);
  loadingBus.increment();
  try {
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
      } catch { }
      throw new ApiError(res.status, message, field, body);
    }

    return res.status === 204 ? (null as unknown as T) : (res.json() as Promise<T>);
  } finally {
    loadingBus.decrement();
  }
}

export const apiClient = {
  get:    <T>(path: string)                  => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)   => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
};

type ProductFields = {
  title: string; description?: string; price: number;
  category?: 'men' | 'women'; images?: string[]; sizes?: string[];
  stock?: 'available' | 'out_of_stock';
  sizeInventory?: Record<string, number>;
};

export const productsApi = {
  list: () => apiClient.get<{ products: unknown[] }>('products'),

  listAll: () => apiClient.get<{ products: unknown[] }>('products/admin'),

  getById: (id: string) =>
    apiClient.get<unknown>(`products/${encodeURIComponent(id)}`),

  add: (product: ProductFields) =>
    apiClient.post<{ id: string }>('products', product),

  update: (id: string, fields: Partial<ProductFields>) =>
    apiClient.put<{ success: boolean }>(`products/${encodeURIComponent(id)}`, fields),

  delete: (id: string) =>
    apiClient.delete<{ success: boolean }>(`products/${encodeURIComponent(id)}`),
};

export const ordersApi = {
  create: (order: CreateOrderPayload) =>
    apiClient.post<CreateOrderResponse>('orders', order),

  mine: () => apiClient.get<{ orders: StoredOrder[] }>('orders/me'),

  all: (params?: { limit?: number; lastDocId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit)     qs.set('limit',     String(params.limit));
    if (params?.lastDocId) qs.set('lastDocId',  params.lastDocId);
    if (params?.status)    qs.set('status',     params.status);
    const query = qs.toString();
    return apiClient.get<{ orders: StoredOrder[]; hasMore: boolean }>(
      `orders${query ? `?${query}` : ''}`,
    );
  },

  getById: (id: string) =>
    apiClient.get<StoredOrder>(`orders/${encodeURIComponent(id)}`),

  updateStatus: (orderId: string, status: OrderStatus) =>
    apiClient.post<{ success: boolean }>(`orders/${encodeURIComponent(orderId)}/status`, { status }),

  track: (id: string) =>
    apiClient.get<TrackOrderResponse>(`orders/track/${encodeURIComponent(id)}`),
};

export const paymentsApi = {
  createRazorpayOrder: (payload: CreateRazorpayOrderPayload) =>
    apiClient.post<CreateRazorpayOrderResponse>('payments/razorpay-order', payload),

  verifyPayment: (payload: VerifyPaymentPayload) =>
    apiClient.post<VerifyPaymentResponse>('payments/verify', payload),

  failPayment: (payload: FailPaymentPayload) =>
    apiClient.post<{ success: boolean }>('payments/fail', payload),

  record: (payload: RecordPaymentPayload) =>
    apiClient.post<RecordPaymentResponse>('payments/record', payload),
};

export interface SignupPayload {
  username: string;
  email: string;
  password: string;
  age: number;
  gender: 'male' | 'female';
  mobileNumber: string;
  address?: string;
}

export interface AuthUserInfo {
  uid: string;
  username: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  success: true;
  token: string;
  user: AuthUserInfo;
}

export const authApi = {
  signup: (payload: SignupPayload) =>
    apiClient.post<AuthResponse>('users/signup', payload),

  login: (payload: { email: string; password: string }) =>
    apiClient.post<AuthResponse>('users/login', payload),
};

export interface UserProfile {
  uid: string;
  username: string | null;
  name: string | null;
  email: string | null;
  age: number | null;
  gender: string | null;
  mobileNumber: string | null;
  address: string | null;
  photoURL: string | null;
  role: string;
  isAdmin: boolean;
  isGuest: boolean;
}

export const userApi = {
  getProfile: () => apiClient.get<UserProfile>('users/me'),

  getCart: () => apiClient.get<{ cart: Array<{ productId: string; qty: number; size?: string | null }> }>('users/cart'),
  putCart: (cart: Array<{ productId: string; qty: number; size?: string | null }>) =>
    apiClient.put<{ success: boolean }>('users/cart', { cart }),

  getWishlist: () => apiClient.get<{ wishlist: string[] }>('users/wishlist'),
  putWishlist: (wishlist: string[]) =>
    apiClient.put<{ success: boolean; wishlist: string[] }>('users/wishlist', { wishlist }),
};
