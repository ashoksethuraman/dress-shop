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
  type SignupPayload,
  type AuthUserInfo,
  type AuthResponse,
  type UserProfile,
} from '../utils/apiTypes';

import type { Product } from '../utils/types';

// re-exports
export type { SignupPayload, AuthUserInfo, AuthResponse, UserProfile };
export type { ApiError };

export const API_BASE_URL =
  process.env.REACT_APP_FUNCTIONS_BASE_URL ||
  `https://asia-south1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/api`;

/* =========================================================
   CSRF HANDLING
========================================================= */

let _csrfRefreshPromise: Promise<void> | null = null;

async function ensureCsrfToken(): Promise<void> {
  if (authService.isCsrfValid()) return;

  if (!_csrfRefreshPromise) {
    _csrfRefreshPromise = fetch(`${API_BASE_URL}/users/csrf-token`, {
      credentials: 'include',
    })
      .then(() => authService.markCsrfFetched())
      .catch(() => { })
      .finally(() => {
        _csrfRefreshPromise = null;
      });
  }

  await _csrfRefreshPromise;
}

async function buildHeaders(
  method: string,
  extra: HeadersInit = {}
): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(extra as Record<string, string>),
  };

  if (!/^(GET|HEAD|OPTIONS)$/i.test(method)) {
    await ensureCsrfToken();
    const csrf = authService.getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  return headers;
}

/* =========================================================
   CORE REQUEST
========================================================= */

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `${API_BASE_URL}/${path}`;

  const method = (options.method ?? 'GET').toUpperCase();
  const headers = await buildHeaders(method, options.headers as HeadersInit);

  loadingBus.increment();

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const text = await res.text();

      let message = `Request failed (${res.status})`;
      let field: string | undefined;
      let body: Record<string, any> | undefined;

      try {
        const json = JSON.parse(text);
        if (json.error) {
          message = json.error;
          field = json.field;
        }
        body = json;
      } catch { }

      throw new ApiError(res.status, message, field, body);
    }

    if (res.status === 204) return null as unknown as T;

    return res.json() as Promise<T>;
  } finally {
    loadingBus.decrement();
  }
}

/* =========================================================
   GENERIC CLIENT
========================================================= */

export const apiClient = {
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    }),
};

/* =========================================================
   PRODUCTS API
========================================================= */

type ProductFields = {
  title: string;
  description?: string;
  price: number;
  category?: 'men' | 'women';
  images?: string[];
  sizes?: string[];
  stock?: 'available' | 'out_of_stock';
  sizeInventory?: Record<string, number>;
  sizeChart?: string;
};

export const productsApi = {
  list: () =>
    apiClient.get<{ products: Product[] }>('products'),

  search: (q: string) =>
    apiClient.get<{ products: Product[] }>(
      `products?q=${encodeURIComponent(q)}`
    ),

  listAll: () =>
    apiClient.get<{ products: Product[] }>('products/admin'),

  getById: (id: string) =>
    apiClient.get<Product>(
      `products/${encodeURIComponent(id)}`
    ),

  add: (product: ProductFields) =>
    apiClient.post<{ id: string }>('products', product),

  update: (id: string, fields: Partial<ProductFields>) =>
    apiClient.put<{ success: boolean }>(
      `products/${encodeURIComponent(id)}`,
      fields
    ),

  delete: (id: string, images: string[]) =>
    apiClient.delete<{ success: boolean }>(
      `products/${encodeURIComponent(id)}`,
      { images } // ✅ correct body
    ),
};

/* =========================================================
   ORDERS API
========================================================= */

export const ordersApi = {
  create: (order: CreateOrderPayload) =>
    apiClient.post<CreateOrderResponse>('orders', order),

  mine: () =>
    apiClient.get<{ orders: StoredOrder[] }>('orders/me'),

  all: (params?: {
    limit?: number;
    lastDocId?: string;
    status?: string;
  }) => {
    const qs = new URLSearchParams();

    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.lastDocId) qs.set('lastDocId', params.lastDocId);
    if (params?.status) qs.set('status', params.status);

    return apiClient.get<{
      orders: StoredOrder[];
      hasMore: boolean;
    }>(`orders${qs.toString() ? `?${qs}` : ''}`);
  },

  getById: (id: string) =>
    apiClient.get<StoredOrder>(
      `orders/${encodeURIComponent(id)}`
    ),

  updateStatus: (orderId: string, status: OrderStatus) =>
    apiClient.post<{ success: boolean }>(
      `orders/${encodeURIComponent(orderId)}/status`,
      { status }
    ),

  track: (id: string) =>
    apiClient.get<TrackOrderResponse>(
      `orders/track/${encodeURIComponent(id)}`
    ),
};

/* =========================================================
   PAYMENTS API
========================================================= */

export const paymentsApi = {
  createRazorpayOrder: (payload: CreateRazorpayOrderPayload) =>
    apiClient.post<CreateRazorpayOrderResponse>(
      'payments/razorpay-order',
      payload
    ),

  verifyPayment: (payload: VerifyPaymentPayload) =>
    apiClient.post<VerifyPaymentResponse>(
      'payments/verify',
      payload
    ),

  failPayment: (payload: FailPaymentPayload) =>
    apiClient.post<{ success: boolean }>(
      'payments/fail',
      payload
    ),

  record: (payload: RecordPaymentPayload) =>
    apiClient.post<RecordPaymentResponse>(
      'payments/record',
      payload
    ),
};

/* =========================================================
   AUTH API
========================================================= */

export const authApi = {
  signup: (payload: SignupPayload) =>
    apiClient.post<AuthResponse>('users/signup', payload),

  login: (payload: { email: string; password: string }) =>
    apiClient.post<AuthResponse>('users/login', payload),

  logout: () =>
    apiClient.post<{ success: boolean }>('users/logout', {}),
};

/* =========================================================
   USER API
========================================================= */

export const userApi = {
  getProfile: () =>
    apiClient.get<UserProfile>('users/me'),

  getCart: () =>
    apiClient.get<{
      cart: Array<{
        productId: string;
        qty: number;
        size?: string | null;
      }>;
    }>('users/cart'),

  putCart: (
    cart: Array<{
      productId: string;
      qty: number;
      size?: string | null;
    }>
  ) =>
    apiClient.put<{ success: boolean }>('users/cart', { cart }),

  getWishlist: () =>
    apiClient.get<{ wishlist: string[] }>('users/wishlist'),

  putWishlist: (wishlist: string[]) =>
    apiClient.put<{ success: boolean; wishlist: string[] }>(
      'users/wishlist',
      { wishlist }
    ),
};

/* =========================================================
   ADMIN USERS API
========================================================= */

export interface ManagedUser {
  id: string;
  username: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string | null;
}

export const adminUsersApi = {
  getAll: () =>
    apiClient.get<{ users: ManagedUser[] }>('users/all'),

  updateStatus: (uids: string[], isActive: boolean) =>
    apiClient.patch<{ success: boolean; updated: number }>(
      'users/status',
      { uids, isActive }
    ),

  setAdmin: (targetUid: string, isAdmin: boolean) =>
    apiClient.post<{ success: boolean }>(
      'users/set-admin',
      { targetUid, isAdmin }
    ),
};