import type {ProductCategory, StockStatus} from "./enums";

export interface CreateProductBody {
  title: string;
  productCode: string;
  description?: string;
  price: number;
  category?: ProductCategory;
  images?: string[];
  sizes?: string[];
  stock?: StockStatus;
  sizeInventory?: Record<string, number>;
  sizeChart?: string;
  shippingAndDelivery?: string;
  exchangeAndReturns?: string;
}

export interface UpdateProductBody {
  title?: string;
  description?: string;
  price?: number;
  category?: ProductCategory;
  images?: string[];
  sizes?: string[];
  stock?: StockStatus;
  sizeInventory?: Record<string, number>;
  sizeChart?: string;
  shippingAndDelivery?: string;
  exchangeAndReturns?: string;
}
