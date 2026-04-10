import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  arrayUnion,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Firestore,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFirebaseApp } from './firebaseClient';
import { authService } from './authService';
import type { Product } from '../utils/types';
import type {
  StoredOrder,
  TrackOrderResponse,
  OrderStatus,
  CreateOrderPayload,
  CreateOrderResponse,
  RecordPaymentPayload,
  RecordPaymentResponse,
  FailPaymentPayload,
} from '../utils/apiTypes';


let _db: Firestore | null = null;

function getDb(): Firestore {
  if (_db) return _db;
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase app is not initialised. Call initFirebase() first.');
  _db = getFirestore(app);
  return _db;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function docToProduct(snap: QueryDocumentSnapshot<DocumentData>): Product {
  const d = snap.data();
  return {
    id:          snap.id,
    title:       d.title       ?? '',
    description: d.description,
    price:       d.price       ?? 0,
    category:    d.category,
    images:      d.images,
    sizes:       d.sizes,
    image:       d.image ?? (Array.isArray(d.images) ? d.images[0] : undefined),
    stock:       d.stock,
  };
}

// ── Products API (mirrors productsApi in apiClient.ts) ────────────────────────

export const firestoreProductsApi = {
  /** Returns only available (stock != 'out_of_stock') products — mirrors GET /products */
  list: async (): Promise<{ products: Product[] }> => {
    const db = getDb();
    // Order by createdAt only — no composite index required.
    // Filter out_of_stock client-side to avoid needing a (stock, createdAt) index.
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const products = snap.docs.map(docToProduct).filter((p) => p.stock !== 'out_of_stock');
    return { products };
  },

  /** Returns all products including out-of-stock — mirrors GET /products/admin */
  listAll: async (): Promise<{ products: Product[] }> => {
    const db = getDb();
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return { products: snap.docs.map(docToProduct) };
  },

  /** Returns a single product by id — mirrors GET /products/:id */
  getById: async (id: string): Promise<Product> => {
    const db = getDb();
    const snap = await getDoc(doc(db, 'products', id));
    if (!snap.exists()) throw new Error(`Product "${id}" not found`);
    return docToProduct(snap as QueryDocumentSnapshot<DocumentData>);
  },

  // ── Admin writes ────────────────────────────────────────────────────────────

  /** Add a new product — mirrors POST /products */
  add: async (product: Omit<Product, 'id'>): Promise<{ id: string }> => {
    const db = getDb();
    const ref = await addDoc(collection(db, 'products'), {
      ...product,
      image: product.image ?? (Array.isArray(product.images) ? product.images[0] : null),
      createdAt: serverTimestamp(),
    });
    return { id: ref.id };
  },

  /** Update fields on an existing product — mirrors PUT /products/:id */
  update: async (id: string, fields: Partial<Omit<Product, 'id'>>): Promise<{ success: boolean }> => {
    const db = getDb();
    await updateDoc(doc(db, 'products', id), {
      ...fields,
      ...(fields.images ? { image: fields.images[0] } : {}),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  },

  /** Delete a product — mirrors DELETE /products/:id */
  delete: async (id: string): Promise<{ success: boolean }> => {
    const db = getDb();
    await deleteDoc(doc(db, 'products', id));
    return { success: true };
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function docToOrder(snap: QueryDocumentSnapshot<DocumentData>): StoredOrder {
  const d = snap.data();
  const ts = (v: any) => (v?.toDate ? v.toDate().toISOString() : v ?? null);
  return {
    id:                     d.id ?? snap.id,
    orderStatus:            d.orderStatus ?? d.status ?? 'PENDING',
    paymentStatus:          d.paymentStatus ?? 'PENDING',
    billingAndShippingSame: d.billingAndShippingAddressSame ?? d.billingAndShippingSame ?? false,
    contactEmail:           d.contactEmail,
    billingAddress:         d.billingAddress,
    shippingAddress:        d.shippingAddress,
    items:                  d.items ?? [],
    subtotal:               d.subtotal ?? d.total ?? 0,
    taxAmount:              d.taxAmount ?? 0,
    shippingFee:            d.shippingFee ?? 0,
    discount:               d.discount ?? 0,
    totalAmount:            d.totalAmount ?? d.total ?? 0,
    paymentId:              d.paymentId,
    timeline:               d.timeline ?? [],
    createdAt:              ts(d.createdAt),
    updatedAt:              ts(d.updatedAt),
  };
}

// ── Orders API (mirrors ordersApi in apiClient.ts) ────────────────────────────

export const firestoreOrdersApi = {
  /** Create a new order — mirrors POST /orders */
  create: async (payload: CreateOrderPayload): Promise<CreateOrderResponse> => {
    const db      = getDb();
    const restored = authService.restoreUser();
    const uid      = restored && !restored.isGuest ? restored.id : `guest_${Date.now()}`;
    const isGuest  = !restored || !!restored.isGuest;
    // Use setDoc with the known payload.id so that subsequent updateDoc calls
    // (record payment, fail payment) can reference the same document by ID.
    await setDoc(doc(db, 'orders', payload.id), {
      ...payload,
      id:            payload.id,
      userId:        uid,
      userEmail:     payload.contactEmail ?? null,
      isGuest,
      orderStatus:   'PENDING',
      paymentStatus: 'PENDING',
      billingAndShippingAddressSame: payload.billingAndShippingSame,
      total:         payload.totalAmount,
      timeline:      [],
      createdAt:     serverTimestamp(),
    });
    return { id: payload.id };
  },

  /** Current user's own orders — mirrors GET /orders/me */
  mine: async (): Promise<{ orders: StoredOrder[] }> => {
    const db  = getDb();
    const uid = authService.restoreUser()?.id;
    if (!uid) return { orders: [] };
    const q   = query(
      collection(db, 'orders'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return { orders: snap.docs.map(docToOrder) };
  },

  /** Admin: all orders with optional pagination/status filter — mirrors GET /orders */
  all: async (params?: {
    limit?: number;
    lastDocId?: string;
    status?: string;
  }): Promise<{ orders: StoredOrder[]; hasMore: boolean }> => {
    const db         = getDb();
    const pageSize   = params?.limit ?? 20;
    const constraints: Parameters<typeof query>[1][] = [orderBy('createdAt', 'desc'), limit(pageSize + 1)];

    if (params?.status) {
      constraints.unshift(where('orderStatus', '==', params.status));
    }

    if (params?.lastDocId) {
      const lastSnap = await getDoc(doc(db, 'orders', params.lastDocId));
      if (lastSnap.exists()) constraints.push(startAfter(lastSnap));
    }

    const snap   = await getDocs(query(collection(db, 'orders'), ...constraints));
    const hasMore = snap.docs.length > pageSize;
    const docs   = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    return { orders: docs.map(docToOrder), hasMore };
  },

  /** Get a single order by id — mirrors GET /orders/:id */
  getById: async (id: string): Promise<StoredOrder> => {
    const db   = getDb();
    const snap = await getDoc(doc(db, 'orders', id));
    if (!snap.exists()) throw new Error(`Order "${id}" not found`);
    return docToOrder(snap as QueryDocumentSnapshot<DocumentData>);
  },

  /** Track an order without auth — mirrors GET /orders/track/:id */
  track: async (id: string): Promise<TrackOrderResponse> => {
    const db   = getDb();
    const snap = await getDoc(doc(db, 'orders', id));
    if (!snap.exists()) throw new Error(`Order "${id}" not found`);
    const d    = snap.data()!;
    const ts   = (v: any) => (v?.toDate ? v.toDate().toISOString() : v ?? null);
    return {
      id:             snap.id,
      orderStatus:    d.orderStatus ?? d.status ?? 'PENDING',
      paymentStatus:  d.paymentStatus ?? 'PENDING',
      paymentMethod:  d.paymentMethod ?? null,
      totalAmount:    d.totalAmount ?? d.total ?? 0,
      createdAt:      ts(d.createdAt),
      shippingAddress: d.shippingAddress ?? null,
      items:          d.items ?? [],
    };
  },

  /** Admin: update order status — mirrors POST /orders/:id/status */
  updateStatus: async (orderId: string, status: OrderStatus): Promise<{ success: boolean }> => {
    const db = getDb();
    await updateDoc(doc(db, 'orders', orderId), {
      orderStatus: status,
      updatedAt:   serverTimestamp(),
    });
    return { success: true };
  },
};

// ── Payments API ─────────────────────────────────────────────────────────────
// Full logic ported from functions/src/routes/payments.ts.
// No backend required — all writes go directly to Firestore.

export const firestorePaymentsApi = {

  /**
   * Record a confirmed payment and mark the order as PLACED.
   * Mirrors POST /payments/record (functions/src/routes/payments.ts).
   * Uses a batch write so both documents update atomically.
   * Idempotent — if the payment doc already exists, skips the write.
   */
  record: async (payload: RecordPaymentPayload): Promise<RecordPaymentResponse> => {
    const db  = getDb();
    const uid = authService.restoreUser()?.id ?? null;

    // batch.set is idempotent — if the payment doc already exists it is
    // overwritten with the same data, so no separate getDoc check needed.
    // (A getDoc here would require READ permission on payments, which guest
    // users don't have — causing the entire payment record to fail.)
    const paymentRef = doc(db, 'payments', payload.paymentId);
    const batch = writeBatch(db);

    // 1. Write the full payment ledger record (matches functions schema exactly)
    batch.set(paymentRef, {
      orderId:            payload.orderId,
      provider:           payload.provider ?? 'mock',
      providerOrderId:    payload.razorpayOrderId ?? null,
      providerPaymentId:  payload.paymentId,
      razorpaySignature:  payload.razorpaySignature ?? null,
      amount:             payload.amount,
      currency:           payload.currency ?? 'INR',
      status:             'SUCCESS',
      method:             payload.method ?? null,
      metadata:           {},
      customerName:       payload.customerName ?? null,
      customerEmail:      payload.customerEmail ?? null,
      userId:             uid,
      isTest:             payload.isTest ?? true,
      paidAt:             serverTimestamp(),
      refundedAt:         null,
      createdAt:          serverTimestamp(),
      updatedAt:          serverTimestamp(),
    });

    // 2. Update the order: PLACED + SUCCESS + timeline entry
    batch.update(doc(db, 'orders', payload.orderId), {
      orderStatus:   'PLACED',
      paymentStatus: 'SUCCESS',
      paymentId:      payload.paymentId,
      updatedAt:      serverTimestamp(),
      timeline:       arrayUnion({
        status:    'PLACED',
        note:      'Payment confirmed',
        timestamp: new Date().toISOString(),
      }),
    });

    await batch.commit();
    return { success: true, paymentId: payload.paymentId };
  },

  /**
   * Mark an order as payment-failed or dismissed.
   * Mirrors POST /payments/fail (functions/src/routes/payments.ts).
   * Idempotent — skips if already CANCELLED/FAILED.
   */
  failPayment: async (payload: FailPaymentPayload): Promise<{ success: boolean }> => {
    const db        = getDb();
    const orderRef  = doc(db, 'orders', payload.orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) return { success: true }; // nothing to update

    const data = orderSnap.data()!;
    // Idempotent — already in a terminal failed/cancelled state
    if (data.orderStatus === 'CANCELLED' || data.paymentStatus === 'FAILED') {
      return { success: true };
    }
    // Never downgrade a paid order
    if (data.paymentStatus === 'SUCCESS') return { success: true };

    const newOrderStatus   = payload.reason === 'payment_failed' ? 'PAYMENT_FAILED' : 'CANCELLED';
    const newPaymentStatus = payload.reason === 'payment_failed' ? 'FAILED'         : 'CANCELLED';

    await updateDoc(orderRef, {
      orderStatus:   newOrderStatus,
      paymentStatus: newPaymentStatus,
      updatedAt:     serverTimestamp(),
      timeline:      arrayUnion({
        status:    newOrderStatus,
        note:      payload.reason,
        timestamp: new Date().toISOString(),
      }),
    });
    return { success: true };
  },

  /** Not available without backend — USE_MOCK_PAYMENT must stay true */
  createRazorpayOrder: async (_payload: any): Promise<any> => {
    throw new Error('createRazorpayOrder requires the backend (HMAC key secret). Keep USE_MOCK_PAYMENT=true.');
  },

  /** Not available without backend — USE_MOCK_PAYMENT must stay true */
  verifyPayment: async (_payload: any): Promise<any> => {
    throw new Error('verifyPayment requires the backend (HMAC key secret). Keep USE_MOCK_PAYMENT=true.');
  },
};
