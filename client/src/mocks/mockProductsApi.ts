import mockProducts from './products.json';
import type { Product } from '../utils/types';

interface MockListParams {
  limit?: number;
  lastDocId?: string;
  q?: string;
  sortBy?: string;
  category?: string;
  availability?: string;
}

interface MockListResponse {
  products: Product[];
  hasMore: boolean;
  lastDocId?: string;
}

export const mockProductsApi = {
  async list(params: MockListParams = {}): Promise<MockListResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const { limit = 10, lastDocId, q, sortBy, category, availability } = params;
    let products = [...mockProducts] as Product[];

    if (category) {
      products = products.filter(p => p.category === category);
    }

    if (availability) {
      products = products.filter(p => p.stock === availability);
    }

    if (q && q.trim()) {
      const query = q.toLowerCase();
      products = products.filter(p =>
        p.title.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.productCode && p.productCode.toLowerCase().includes(query))
      );
    }

    if (sortBy) {
      switch (sortBy) {
        case 'price-asc':
          products.sort((a, b) => a.price - b.price);
          break;
        case 'price-desc':
          products.sort((a, b) => b.price - a.price);
          break;
        case 'name-asc':
          products.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'name-desc':
          products.sort((a, b) => b.title.localeCompare(a.title));
          break;
        case 'newest':
          products.sort((a, b) => {
            const dateA = new Date((a as any).createdAt).getTime();
            const dateB = new Date((b as any).createdAt).getTime();
            return dateB - dateA;
          });
          break;
      }
    }

    let startIndex = 0;
    if (lastDocId) {
      const lastIndex = products.findIndex(p => p.id === lastDocId);
      if (lastIndex !== -1) {
        startIndex = lastIndex + 1;
      }
    }

    const paginatedProducts = products.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < products.length;
    const lastDoc = paginatedProducts[paginatedProducts.length - 1];

    return {
      products: paginatedProducts,
      hasMore,
      lastDocId: lastDoc?.id
    };
  },

  async getById(id: string): Promise<Product> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const product = mockProducts.find(p => p.id === id);
    if (!product) {
      throw new Error('Product not found');
    }
    return product as Product;
  },

  async search(q: string): Promise<{ products: Product[] }> {
    await new Promise(resolve => setTimeout(resolve, 200));
    if (!q.trim()) {
      return { products: [] };
    }
    const query = q.toLowerCase();
    const results = mockProducts.filter(p =>
      p.title.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query)) ||
      (p.productCode && p.productCode.toLowerCase().includes(query))
    ) as Product[];
    return { products: results };
  },

  async listAll(): Promise<{ products: Product[] }> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { products: mockProducts as Product[] };
  }
};
