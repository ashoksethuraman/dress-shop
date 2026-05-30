import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { productsApi, ordersApi } from '../services/apiClient';
import type { Product, DeletePayload } from '../utils/types';
import type { StoredOrder, TrackOrderResponse } from '../utils/apiTypes';

interface QueryError {
  status: number | 'CUSTOM_ERROR';
  data: { message: string };
}

export const dressShopApi = createApi({
  reducerPath: 'dressShopApi',
  baseQuery: fakeBaseQuery<QueryError>(),
  tagTypes: ['Product', 'Order', 'MyOrders'],
  keepUnusedDataFor: 300,

  endpoints: (builder) => ({
    /* -----------------------------------------------------------
       PRODUCTS LIST
    ----------------------------------------------------------- */
    getProducts: builder.query<Product[], boolean>({
      keepUnusedDataFor: 300,
      async queryFn(includeAll) {
        try {
          const { products } = includeAll
            ? await productsApi.listAll()
            : await productsApi.list();

          return { data: products };
        } catch (err: any) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: err?.message ?? 'Failed to load products' },
            },
          };
        }
      },
      providesTags: (result, _err, includeAll) =>
        result
          ? [
              ...result.map((p) => ({ type: 'Product' as const, id: p.id })),
              { type: 'Product', id: includeAll ? 'ADMIN_LIST' : 'LIST' },
            ]
          : [{ type: 'Product', id: includeAll ? 'ADMIN_LIST' : 'LIST' }],
    }),

    /* -----------------------------------------------------------
       PRODUCT DETAIL
    ----------------------------------------------------------- */
    getProductById: builder.query<Product, string>({
      keepUnusedDataFor: 300,
      async queryFn(id) {
        try {
          const data = await productsApi.getById(id);
          return { data };
        } catch (err: any) {
          return {
            error: {
              status: 404,
              data: { message: err?.message ?? 'Failed to load product' },
            },
          };
        }
      },
      providesTags: (_result, _err, id) => [{ type: 'Product', id }],
    }),

    /* -----------------------------------------------------------
       SEARCH PRODUCTS
    ----------------------------------------------------------- */
    searchProducts: builder.query<Product[], string>({
      keepUnusedDataFor: 60,
      async queryFn(q) {
        if (!q.trim()) return { data: [] };

        try {
          const { products } = await productsApi.search(q);
          return { data: products };
        } catch (err: any) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: err?.message ?? 'Search failed' },
            },
          };
        }
      },
      providesTags: (_result, _err, q) => [
        { type: 'Product', id: `SEARCH_${q}` },
      ],
    }),

    /* -----------------------------------------------------------
       PAGED PRODUCTS (server-side pagination, cached per-arg)
    ----------------------------------------------------------- */
    getProductsPaged: builder.query<
      { products: Product[]; hasMore?: boolean; lastDocId?: string },
      { includeAll?: boolean; limit?: number; lastDocId?: string; q?: string; sortBy?: string; category?: string; availability?: string; type?: string }
    >({
      keepUnusedDataFor: 300,
      async queryFn(arg) {
        try {
          const res = await productsApi.list({
            limit: arg?.limit,
            lastDocId: arg?.lastDocId,
            q: arg?.q,
            sortBy: arg?.sortBy,
            category: arg?.category,
            availability: arg?.availability,
            type: arg?.type,
          });
          return { data: res };
        } catch (err: any) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: err?.message ?? 'Failed to load products' },
            },
          };
        }
      },
      providesTags: (result, _err, arg) =>
        result
          ? [
              ...result.products.map((p) => ({ type: 'Product' as const, id: p.id })),
              { type: 'Product', id: arg?.includeAll ? 'ADMIN_LIST' : 'LIST' },
            ]
          : [{ type: 'Product', id: arg?.includeAll ? 'ADMIN_LIST' : 'LIST' }],
    }),

    /* -----------------------------------------------------------
       TRACK ORDER
    ----------------------------------------------------------- */
    trackOrder: builder.query<TrackOrderResponse, string>({
      keepUnusedDataFor: 60,
      async queryFn(id) {
        try {
          const data = await ordersApi.track(id);
          return { data };
        } catch (err: any) {
          return {
            error: {
              status: 404,
              data: { message: err?.message ?? 'Order not found' },
            },
          };
        }
      },
      providesTags: (_result, _err, id) => [{ type: 'Order', id }],
    }),

    /* -----------------------------------------------------------
       USER ORDERS
    ----------------------------------------------------------- */
    getMyOrders: builder.query<StoredOrder[], void>({
      keepUnusedDataFor: 30,
      async queryFn() {
        try {
          const { orders } = await ordersApi.mine();
          return { data: orders };
        } catch (err: any) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: err?.message ?? 'Failed to load orders' },
            },
          };
        }
      },
      providesTags: [{ type: 'MyOrders', id: 'LIST' }],
    }),

    /* -----------------------------------------------------------
       DELETE PRODUCT
    ----------------------------------------------------------- */
    deleteProduct: builder.mutation<{ success: boolean }, DeletePayload>({
      async queryFn({ id, images }) {
        try {
          const result = await productsApi.delete(id, images);
          return { data: result };
        } catch (err: any) {
          return {
            error: {
              status: 400,
              data: { message: err?.message ?? 'Failed to delete product' },
            },
          };
        }
      },

      invalidatesTags: (_result, _err, arg) => [
        { type: 'Product', id: arg.id },
        { type: 'Product', id: 'LIST' },
        { type: 'Product', id: 'ADMIN_LIST' },
      ],
    }),
  }),
});

/* -----------------------------------------------------------
   HOOK EXPORTS
----------------------------------------------------------- */
export const {
  useGetProductsQuery,
  useGetProductByIdQuery,
  useSearchProductsQuery,
  useGetProductsPagedQuery,
  useLazyGetProductsPagedQuery,
  useLazyTrackOrderQuery,
  useGetMyOrdersQuery,
  useDeleteProductMutation,
} = dressShopApi;