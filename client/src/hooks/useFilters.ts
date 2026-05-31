import { useCallback, useState } from 'react';

export type FilterParams = {
  category: string; // 'ALL' or category slug
  type: string; // 'ALL' or type key
  q: string;
};

const DEFAULT_FILTERS: FilterParams = { category: 'ALL', type: 'ALL', q: '' };

export function useFilters(initial?: Partial<FilterParams>) {
  const [filters, setFilters] = useState<FilterParams>({ ...DEFAULT_FILTERS, ...(initial || {}) });

  const setPartial = useCallback((p: Partial<FilterParams>) => {
    setFilters((s) => ({ ...s, ...p }));
  }, []);

  const reset = useCallback(() => setFilters({ ...DEFAULT_FILTERS }), []);

  const toQueryParams = useCallback((f: FilterParams = filters) => {
    const params: Record<string, string> = {};
    if (f.q && f.q.trim()) params.q = f.q.trim();
    if (f.category && f.category !== 'ALL') params.category = f.category.toLowerCase();
    if (f.type && f.type !== 'ALL') params.type = f.type;
    return params;
  }, [filters]);

  return {
    filters,
    setFilters: setPartial,
    reset,
    toQueryParams,
  } as const;
}

export default useFilters;
