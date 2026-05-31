import type {ProductCategory, StockStatus} from "./enums";

export type AgeSize = "8-9" | "9-10" | "10-11" | "11-12" | "12-13" | "13-14" | "14-15" | "15-16";

export interface CreateProductBody {
  title: string;
  productCode: string;
  description?: string;
  price: number;
  category?: ProductCategory;
  type?: string;
  images?: string[];
  // Adult products (men/women) use sizes
  sizes?: string[];
  sizeInventory?: Record<string, number>;
  // Children products (boys/girls) use ageSizes
  ageSizes?: AgeSize[];
  ageSizeInventory?: Record<AgeSize, number>;
  stock?: StockStatus;
  sizeChart?: string;
  shippingAndDelivery?: string;
  exchangeAndReturns?: string;
}

export interface UpdateProductBody {
  title?: string;
  description?: string;
  price?: number;
  category?: ProductCategory;
  type?: string;
  images?: string[];
  sizes?: string[];
  sizeInventory?: Record<string, number>;
  ageSizes?: AgeSize[];
  ageSizeInventory?: Record<AgeSize, number>;
  stock?: StockStatus;
  sizeChart?: string;
  shippingAndDelivery?: string;
  exchangeAndReturns?: string;
}
