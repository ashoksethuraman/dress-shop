import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { productsApi, ordersApi } from '../services/apiClient'; // backend
// import { firestoreProductsApi as productsApi, firestoreOrdersApi as ordersApi } from '../services/firestoreClient'; // direct firestore
import type { Product } from '../utils/types';
import type { StoredOrder, TrackOrderResponse } from '../utils/apiTypes';


export const dressShopApi = createApi({
  reducerPath: 'dressShopApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Product', 'Order', 'MyOrders'],
  keepUnusedDataFor: 300,

  endpoints: (builder) => ({

    getProducts: builder.query<Product[], boolean>({
      keepUnusedDataFor: 300,
      queryFn: async (includeAll) => {
        try {
          if (includeAll) {
            const { products } = await productsApi.listAll();
            return { data: products as Product[] };
          }
          const { products } = await productsApi.list();
          return { data: products as Product[] };
        } catch (err: any) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: err?.message ?? 'Failed to load products',
            },
          };
        }
      },
      providesTags: (result, _err, includeAll) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Product' as const, id })),
              { type: 'Product' as const, id: includeAll ? 'ADMIN_LIST' : 'LIST' },
            ]
          : [{ type: 'Product' as const, id: includeAll ? 'ADMIN_LIST' : 'LIST' }],
    }),

    getProductById: builder.query<Product, string>({
      keepUnusedDataFor: 300,
      queryFn: async (id) => {
        try {
          const data = await productsApi.getById(id);
          return { data: data as Product };
        } catch (err: any) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: err?.message ?? 'Failed to load product',
            },
          };
        }
      },
      providesTags: (_result, _err, id) => [{ type: 'Product', id }],
    }),


    trackOrder: builder.query<TrackOrderResponse, string>({
      keepUnusedDataFor: 60,
      queryFn: async (id) => {
        try {
          const data = await ordersApi.track(id);
          return { data };
        } catch (err: any) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: err?.message ?? 'Order not found',
            },
          };
        }
      },
      providesTags: (_result, _err, id) => [{ type: 'Order', id }],
    }),

    getMyOrders: builder.query<StoredOrder[], void>({
      keepUnusedDataFor: 30,
      queryFn: async () => {
        try {
          const { orders } = await ordersApi.mine();
          return { data: orders };
        } catch (err: any) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: err?.message ?? 'Failed to load orders',
            },
          };
        }
      },
      providesTags: [{ type: 'MyOrders', id: 'LIST' }],
    }),


    deleteProduct: builder.mutation<{ success: boolean }, string>({
      queryFn: async (id) => {
        try {
          const result = await productsApi.delete(id);
          return { data: result };
        } catch (err: any) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: err?.message ?? 'Failed to delete product',
            },
          };
        }
      },
      invalidatesTags: (_result, _err, id) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
        { type: 'Product', id: 'ADMIN_LIST' },
      ],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductByIdQuery,
  useLazyTrackOrderQuery,
  useGetMyOrdersQuery,
  useDeleteProductMutation,
} = dressShopApi;
