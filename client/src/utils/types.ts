export type Product = {
  id: string;
  title: string;
  description?: string;
  price: number;
  category?: 'men' | 'women';
  images?: string[];   // array of image URLs / base64
  sizes?: string[];    // e.g. ['S', 'M', 'L']
  image?: string;      // backward-compat: first image
};

export type CartItem = {
  productId: string;
  title: string;
  price: number;
  qty: number;
};

export type User = {
  id: string;
  name?: string;
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
  billingOption: 'same' | 'different';
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
