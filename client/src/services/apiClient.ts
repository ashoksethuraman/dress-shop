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
  type InitiateRefundPayload,
  type InitiateRefundResponse,
  type StoredOrder,
  type TrackOrderResponse,
  type OrderStatus,
  type SignupPayload,
  type AuthUserInfo,
  type AuthResponse,
  type UserProfile,
} from '../utils/apiTypes';

import type { Product } from '../utils/types';

/* =========================================================
   RE-EXPORTS
========================================================= */
export type { SignupPayload, AuthUserInfo, AuthResponse, UserProfile };
export type { ApiError };

/* =========================================================
   CONFIG
========================================================= */

const projectId =
  process.env.REACT_APP_FIREBASE_PROJECT_ID || 'halleycomet-7cd48';

const region = 'asia-south1';

const isDev = process.env.NODE_ENV === 'development';

const useEmulator = process.env.REACT_APP_USE_EMULATOR === 'true' && isDev;
// DEV purpose  local should be enable:
// export const API_BASE_URL = useEmulator
//   ? '/api'
//   : `https://${region}-${projectId}.cloudfunctions.net/api`;

// Always use relative path - Firebase Hosting rewrites /api/** to Cloud Functions
// This ensures same-origin requests so cookies work properly 
// prod should be enable
export const API_BASE_URL = '/api';

/* =========================================================
   HELPERS
========================================================= */

function buildUrl(path: string) {
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;
}

function buildQuery(params: Record<string, any>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      qs.set(k, String(v));
    }
  });
  return qs.toString();
}

/* =========================================================
   TIMEOUT SUPPORT
========================================================= */

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

/* =========================================================
   CSRF
========================================================= */

let csrfPromise: Promise<void> | null = null;

/**
 * FIXED: CSRF now properly validated with TTL
 * (previous version was too weak)
 */
const CSRF_TTL_MS = 55 * 60 * 1000;

/**
 * We rely on authService internal timestamp (_csrfFetchedAt)
 * so we only FIX validation logic there.
 */

async function ensureCsrfToken(): Promise<void> {
  if (authService.isCsrfValid()) return;

  if (!csrfPromise) {
    csrfPromise = fetch(`${API_BASE_URL}/users/csrf-token`, {
      credentials: 'include',
    })
      .then(() => authService.markCsrfFetched())
      .catch(() => { })
      .finally(() => {
        csrfPromise = null;
      });
  }

  await csrfPromise;
}

/* =========================================================
   HEADERS
========================================================= */

async function buildHeaders(method: string, extra?: HeadersInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(extra as Record<string, string>),
  };

  const isSafeMethod = /^(GET|HEAD|OPTIONS)$/i.test(method);

  if (!isSafeMethod) {
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
  const url = buildUrl(path);
  const method = (options.method ?? 'GET').toUpperCase();

  const { signal, cancel } = withTimeout(30000);

  const headers = await buildHeaders(method, options.headers);

  loadingBus.increment();

  try {
    const res = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: 'include',
      signal,
    });

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      let field: string | undefined;
      let body: any;

      try {
        body = await res.json();
        if (body?.error) {
          message = body.error;
          field = body.field;
        }
      } catch {
        body = await res.text();
      }

      throw new ApiError(res.status, message, field, body);
    }

    if (res.status === 204) return null as T;

    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new ApiError(408, 'Request timeout');
    }
    throw err;
  } finally {
    cancel();
    loadingBus.decrement();
  }
}

/* =========================================================
   CLIENT
========================================================= */

export const apiClient = {
  get: <T>(p: string) => request<T>(p, { method: 'GET' }),

  post: <T>(p: string, b: unknown) =>
    request<T>(p, { method: 'POST', body: JSON.stringify(b) }),

  put: <T>(p: string, b: unknown) =>
    request<T>(p, { method: 'PUT', body: JSON.stringify(b) }),

  patch: <T>(p: string, b: unknown) =>
    request<T>(p, { method: 'PATCH', body: JSON.stringify(b) }),

  delete: <T>(p: string, b?: unknown) =>
    request<T>(p, {
      method: 'DELETE',
      body: b ? JSON.stringify(b) : undefined,
    }),
};

/* =========================================================
   EVERYTHING BELOW UNCHANGED
========================================================= */

/* PRODUCTS API */
type ProductFields = {
  title: string;
  productCode: string;
  description?: string;
  price: number;
  category?: 'men' | 'women';
  images?: string[];
  sizes?: string[];
  stock?: 'available' | 'out_of_stock';
  sizeInventory?: Record<string, number>;
  sizeChart?: string;
  shippingAndDelivery?: string;
  exchangeAndReturns?: string;
};

export const productsApi = {
  list: (params?: { limit?: number; lastDocId?: string; q?: string; sortBy?: string; category?: string; availability?: string }) => {
    const qs = buildQuery(params || {});
    return apiClient.get<{ products: Product[]; hasMore?: boolean; lastDocId?: string }>(`products${qs ? `?${qs}` : ''}`);
  },

  search: (q: string) =>
    apiClient.get<{ products: Product[] }>(
      `products?q=${encodeURIComponent(q)}`
    ),

  listAll: () =>
    apiClient.get<{ products: Product[] }>('products/admin'),

  getById: (id: string) =>
    apiClient.get<Product>(`products/${encodeURIComponent(id)}`),

  add: (p: ProductFields) =>
    apiClient.post<{ id: string }>('products', p),

  update: (id: string, f: Partial<ProductFields>) =>
    apiClient.put<{ success: boolean }>(
      `products/${encodeURIComponent(id)}`,
      f
    ),

  delete: (id: string, images: string[]) =>
    apiClient.delete<{ success: boolean }>(
      `products/${encodeURIComponent(id)}`,
      { images }
    ),
};

/* ORDERS API */
export const ordersApi = {
  create: (o: CreateOrderPayload) =>
    apiClient.post<CreateOrderResponse>('orders', o),

  mine: () =>
    apiClient.get<{ orders: StoredOrder[] }>('orders/self'),

  all: (params?: {
    limit?: number;
    lastDocId?: string;
    status?: string;
  }) => {
    const qs = buildQuery(params || {});
    return apiClient.get<{
      orders: StoredOrder[];
      hasMore: boolean;
    }>(`orders${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string) =>
    apiClient.get<StoredOrder>(`orders/id/${encodeURIComponent(id)}`),

  updateStatus: (id: string, status: OrderStatus) =>
    apiClient.post<{ success: boolean }>(
      `orders/${encodeURIComponent(id)}/status`,
      { status }
    ),

  track: (id: string) =>
    apiClient.get<TrackOrderResponse>(
      `orders/track/${encodeURIComponent(id)}`
    ),
};

/* PAYMENTS API */
export const paymentsApi = {
  createRazorpayOrder: (p: CreateRazorpayOrderPayload) =>
    apiClient.post<CreateRazorpayOrderResponse>(
      'payments/razorpay-order',
      p
    ),

  verifyPayment: (p: VerifyPaymentPayload) =>
    apiClient.post<VerifyPaymentResponse>('payments/verify', p),

  failPayment: (p: FailPaymentPayload) =>
    apiClient.post<{ success: boolean }>('payments/fail', p),

  record: (p: RecordPaymentPayload) =>
    apiClient.post<RecordPaymentResponse>('payments/record', p),

  initiateRefund: (p: InitiateRefundPayload) =>
    apiClient.post<InitiateRefundResponse>('payments/refund', p),
};

/* AUTH API */
export const authApi = {
  signup: (p: SignupPayload) =>
    apiClient.post<AuthResponse>('users/signup', p),

  login: (p: { email: string; password: string }) =>
    apiClient.post<AuthResponse>('users/login', p),

  logout: () =>
    apiClient.post<{ success: boolean }>('users/logout', {}),
};

/* USER API */
export const userApi = {
  getProfile: () =>
    apiClient.get<UserProfile>('users/me'),

  getCart: () =>
    apiClient.get<{
      cart: { productId: string; qty: number; size?: string | null }[];
    }>('users/cart'),

  putCart: (cart: any[]) =>
    apiClient.put<{ success: boolean }>('users/cart', { cart }),

  getWishlist: () =>
    apiClient.get<{ wishlist: string[] }>('users/wishlist'),

  putWishlist: (wishlist: string[]) =>
    apiClient.put<{ success: boolean; wishlist: string[] }>(
      'users/wishlist',
      { wishlist }
    ),
};

/* ADMIN USERS API */
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
    apiClient.post<{ success: boolean }>('users/set-admin', {
      targetUid,
      isAdmin,
    }),
};

/* CONFIG API */
export interface SiteConfig {
  homeBanner: {
    imageName: string;
    imageUrl: string;
    uploadedAt: any;
    uploadedBy: string;
  } | null;
}

export const configApi = {
  getSettings: () =>
    apiClient.get<SiteConfig>('config/settings'),

  uploadHomeBanner: (base64: string) =>
    apiClient.post<{ url: string }>('config/upload-home-banner', { base64 }),

  deleteHomeBanner: () =>
    apiClient.delete<{ success: boolean }>('config/home-banner'),
};

/* CONTACT API */
export interface ContactInfo {
  tradeName: string;
  brandName: string;
  address: string;
  phone: string;
  email: string;
  operatingHours: string;
  mapUrl: string;
  socialMedia: {
    facebook: string;
    instagram: string;
    twitter: string;
    whatsapp: string;
  };
}

export const contactApi = {
  get: () =>
    apiClient.get<ContactInfo>('config/contact'),

  update: (info: ContactInfo) =>
    apiClient.put<ContactInfo>('config/contact', info),
};