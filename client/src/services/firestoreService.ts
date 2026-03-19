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

// Fallback in-memory data when Firebase is not configured
let _products: Product[] = [
  { id: 'p1', title: 'Red Floral Dress', description: 'Elegant red dress for special occasions', price: 79.99, category: 'women', images: ['https://picsum.photos/seed/red/600/600'], sizes: ['S', 'M', 'L'], image: 'https://picsum.photos/seed/red/600/600' },
  { id: 'p2', title: 'Blue Casual Dress', description: 'Everyday relaxed blue dress', price: 59.50, category: 'women', images: ['https://picsum.photos/seed/blue/600/600'], sizes: ['M', 'L', 'XL'], image: 'https://picsum.photos/seed/blue/600/600' },
  { id: 'p3', title: 'Green Summer Dress', description: 'Light and breezy summer style', price: 49.00, category: 'women', images: ['https://picsum.photos/seed/green/600/600'], sizes: ['XS', 'S', 'M'], image: 'https://picsum.photos/seed/green/600/600' },
  { id: 'p4', title: 'Classic Polo Shirt', description: 'Smart casual polo for men', price: 39.99, category: 'men', images: ['https://picsum.photos/seed/polo/600/600'], sizes: ['S', 'M', 'L', 'XL'], image: 'https://picsum.photos/seed/polo/600/600' },
  {id:'product4', title: 'mens wear', description:"casual wear for all time", price: 199, sizes:['Xs', 'S', 'L', 'M', 'XL'], images: ['mens-1.jpeg', 'mens-2.jpeg', 'mens-3.jpeg'], image:'mens-1.jpeg' },
  {id:'product5', title: 'womens dress', description:"casual wear for winter time", price: 229, sizes:['Xs', 'S', 'L', 'M', 'XL'], images: ['womens-1.jpeg', 'womens-2.jpeg', 'womens-3.jpeg'], image:'womens-1.jpeg' }

];

async function getDb(): Promise<Firestore | null> {
  return getFirestoreDb();
}

export const firestoreService = {
  getProducts: async (): Promise<Product[]> => {
    const db = await getDb();
    if (!db) {
      await new Promise((r) => setTimeout(r, 200));
      return _products;
    }
    const snap = await getDocs(collection(db, 'products'));
    return snap.docs.map((d) => {
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
      } as Product;
    });
  },

  addProduct: async (p: Product): Promise<Product> => {
    const db = await getDb();
    if (!db) {
      _products = [..._products, p];
      return p;
    }
    const ref = await addDoc(collection(db, 'products'), {
      title: p.title,
      description: p.description || '',
      price: p.price,
      category: p.category || 'women',
      images: p.images || [],
      sizes: p.sizes || [],
      image: p.images?.[0] || p.image || '',
    });
    return { ...p, id: ref.id };
  },

  deleteProduct: async (id: string): Promise<void> => {
    const db = await getDb();
    if (!db) {
      _products = _products.filter((p) => p.id !== id);
      return;
    }
    await deleteDoc(doc(db, 'products', id));
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
