export type StockStatus = 'available' | 'out_of_stock';

export type ProductCategory = 'men' | 'women' | 'boys' | 'girls';
export type AgeSize = '8-9' | '9-10' | '10-11' | '11-12' | '12-13' | '13-14' | '14-15' | '15-16';

export type Product = {
  id: string;
  title: string;
  description?: string;
  price: number;
  category?: ProductCategory;
  type?: string;
  images?: string[];
  // Adult products use sizes
  sizes?: string[];
  sizeInventory?: Record<string, number>;
  // Children products use ageSizes
  ageSizes?: AgeSize[];
  ageSizeInventory?: Record<AgeSize, number>;
  image?: string;
  stock?: StockStatus;
  salesCount?: number;
  sizeChart?: string;
  productCode?: string;
  exchangeAndReturns?: string;
  shippingAndDelivery?: string;
};

export type DeletePayload = {
  id: string;
  images: string[];
};

export type CartItem = {
  productId: string;
  title: string;
  price: number;
  qty: number;
  category?: ProductCategory;
  // Adult products use size
  size?: string | null;
  // Children products use ageSize
  ageSize?: AgeSize | null;
  stock?: StockStatus;
  maxQty?: number;
  // optional thumbnail/image reference (first image or image path)
  image?: string | null;
};

export type User = {
  id: string;
  name?: string;
  photoURL?: string;
  isGuest?: boolean;
  isAdmin?: boolean;
};

/* ─── Checkout ───────────────────────────────────────────── */
export interface AddressData {
  firstName: string;
  lastName: string;
  company: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
}

export interface CheckoutFormState {
  email: string;
  emailOffers: boolean;
  shippingAddress: AddressData;
  billingAddress?: AddressData;
  saveInfo: boolean;
  textOffers: boolean;
  billingOptionSame: boolean;
}

export interface FormErrors {
  [key: string]: string;
}

export const INDIAN_STATES: string[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra & Nagar Haveli', 'Daman & Diu',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
