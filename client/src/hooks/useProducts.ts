import { useCallback } from 'react';
import { useAppDispatch } from '../store/hooks';
import { dressShopApi, useGetProductsQuery } from '../store/apiSlice';
import { Product } from '../utils/types';

interface UseProductsOptions {
  includeAll?: boolean;
}

interface UseProductsResult {
  products: Product[];
  loading:  boolean;
  error:    boolean;
  refresh:  (opts?: { bust?: boolean }) => void;
}

export function useProducts({ includeAll = false }: UseProductsOptions = {}): UseProductsResult {
  const dispatch = useAppDispatch();

  const publicResult = useGetProductsQuery(false, {
    skip: includeAll,
  });
  const adminResult = useGetProductsQuery(true, {
    skip: !includeAll,
    refetchOnMountOrArgChange: true,
  });

  const active = includeAll ? adminResult : publicResult;

  const refresh = useCallback(
    (opts?: { bust?: boolean }) => {
      if (opts?.bust) {
        dispatch(
          dressShopApi.util.invalidateTags([
            { type: 'Product', id: includeAll ? 'ADMIN_LIST' : 'LIST' },
          ]),
        );
      }
      active.refetch();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [includeAll, dispatch],
  );

  return {
    products: active.data ?? [],
    loading:  active.isLoading || active.isFetching,
    error:    active.isError,
    refresh,
  };
}
