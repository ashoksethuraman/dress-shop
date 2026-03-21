import { Product } from '../utils/types';
import { initFirebase, getFirestoreDb } from './firebaseClient';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  Firestore,
} from 'firebase/firestore';

initFirebase();

// ── Two-level product cache ────────────────────────────────────────────────
// L1 — module-level memory  : fastest, lives for the current JS runtime
// L2 — sessionStorage       : survives page refresh / F5, scoped to the tab
//
// Cache hierarchy on getProducts():
//   L1 hit → return immediately (no I/O)
//   L2 hit → warm L1 and return (no Firestore read)
//   miss   → fetch Firestore, write both levels
//
// Any mutation (add/delete) busts both levels so stale data is never shown.
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_KEY    = 'ds_products_cache'; // "ds" = dress-shop

let _productsCache: { data: Product[]; expiresAt: number } | null = null;

function readSessionCache(): Product[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: { data: Product[]; expiresAt: number } = JSON.parse(raw);
    if (Date.now() < parsed.expiresAt) return parsed.data;
    sessionStorage.removeItem(CACHE_KEY); // expired — clean up
  } catch { /* SSR / private-browsing environments — ignore */ }
  return null;
}

function writeSessionCache(data: Product[]): void {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, expiresAt: Date.now() + CACHE_TTL_MS })
    );
  } catch { /* quota exceeded — silently skip */ }
}

/** Call this after any mutation (add / delete) to force a fresh fetch. */
export function invalidateProductsCache(): void {
  _productsCache = null;
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

// Fallback in-memory data when Firebase is not configured
let _products: Product[] = [
  { id: 'p1', title: 'Red Floral Dress', description: 'Elegant red dress for special occasions', price: 79.99, category: 'women', images: ['https://picsum.photos/seed/red/600/600'], sizes: ['S', 'M', 'L'], image: 'https://picsum.photos/seed/red/600/600' },
  { id: 'p2', title: 'Blue Casual Dress', description: 'Everyday relaxed blue dress', price: 59.50, category: 'women', images: ['https://picsum.photos/seed/blue/600/600'], sizes: ['M', 'L', 'XL'], image: 'https://picsum.photos/seed/blue/600/600' },
  { id: 'p3', title: 'Green Summer Dress', description: 'Light and breezy summer style', price: 49.00, category: 'women', images: ['https://picsum.photos/seed/green/600/600'], sizes: ['XS', 'S', 'M'], image: 'https://picsum.photos/seed/green/600/600' },
  { id: 'p4', title: 'Classic Polo Shirt', description: 'Smart casual polo for men', price: 39.99, category: 'men', images: ['https://picsum.photos/seed/polo/600/600'], sizes: ['S', 'M', 'L', 'XL'], image: 'https://picsum.photos/seed/polo/600/600' },
  {id:'product4', title: 'mens wear', description:"casual wear for all time", price: 199,  category: 'men', sizes:['Xs', 'S', 'L', 'M', 'XL'], images: ['mens-1.jpeg', 'mens-2.jpeg', 'mens-3.jpeg'], image:'mens-1.jpeg' },
  {id:'product5', title: 'womens dress', description:"casual wear for winter time", price: 229,  category: 'women', sizes:['Xs', 'S', 'L', 'M', 'XL'], images: ['womens-1.jpeg', 'womens-2.jpeg', 'womens-3.jpeg'], image:'womens-1.jpeg' }

];

async function getDb(): Promise<Firestore | null> {
  return getFirestoreDb();
}

export const firestoreService = {
  getProducts: async (options?: { includeAll?: boolean }): Promise<Product[]> => {
    // L1 — memory hit (fastest path; zero I/O) — skip cache for admin all-products requests
    if (!options?.includeAll && _productsCache && Date.now() < _productsCache.expiresAt) {
      return _productsCache.data;
    }

    // L2 — sessionStorage hit (survives page refresh)
    const sessionData = readSessionCache();
    if (!options?.includeAll && sessionData) {
      _productsCache = { data: sessionData, expiresAt: Date.now() + CACHE_TTL_MS };
      return sessionData;
    }

    // L3 — fetch from Firestore (one read per 5-minute window per tab)
    const db = await getDb();
    let products: Product[];

    if (!db) {
      await new Promise((r) => setTimeout(r, 200));
      products = _products;
    } else {
      const snap = await getDocs(collection(db, 'products'));
      const allProducts = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data.title,
          description: data.description || '',
          price: data.price,
          category: data.category || 'women',
          images: data.images || (data.image ? [data.image] : []),
          sizes: data.sizes || [],
          image: data.image || (data.images?.[0] ?? ''),
          stock: data.stock ?? 'available',
        } as Product;
      });
      // Mirror the server-side filter: hide out_of_stock products (unless admin requested all)
      products = options?.includeAll
        ? allProducts
        : allProducts.filter((p) => p.stock !== 'out_of_stock');
    }

    // Only cache the public (filtered) result — do NOT pollute the cache with admin all-products
    if (!options?.includeAll) {
      writeSessionCache(products);
      _productsCache = { data: products, expiresAt: Date.now() + CACHE_TTL_MS };
    }
    return products;
  },

  addProduct: async (p: Product): Promise<Product> => {
    const db = await getDb();
    let added: Product;

    if (!db) {
      _products = [..._products, p];
      added = p;
    } else {
      const ref = await addDoc(collection(db, 'products'), {
        title: p.title,
        description: p.description || '',
        price: p.price,
        category: p.category || 'women',
        images: p.images || [],
        sizes: p.sizes || [],
        image: p.images?.[0] || p.image || '',
        stock: p.stock ?? 'available',
      });
      added = { ...p, id: ref.id };
    }

    invalidateProductsCache(); // bust cache after write
    return added;
  },

  deleteProduct: async (id: string): Promise<void> => {
    const db = await getDb();
    if (!db) {
      _products = _products.filter((p) => p.id !== id);
    } else {
      await deleteDoc(doc(db, 'products', id));
    }
    invalidateProductsCache(); // bust cache after write
  },

  createOrder: async (order: any): Promise<{ id: string }> => {
    const db = await getDb();
    if (!db) {
      await new Promise((r) => setTimeout(r, 200));
      return { id: `order_${Date.now()}` };
    }
    const ref = await addDoc(collection(db, 'orders'), order);
    return { id: ref.id };
  },

  getOrderById: async (orderId: string): Promise<any | null> => {
    const db = await getDb();
    if (!db) return null;
    const snap = await getDocs(query(collection(db, 'orders'), where('id', '==', orderId)));
    if (snap.empty) return null;
    return snap.docs[0].data();
  },
};
