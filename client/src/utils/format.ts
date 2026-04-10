export function formatPrice(price: number): string {
  return `₹${price.toFixed(2)}`;
}

interface AddressLike {
  name?:    string;
  line1?:   string;
  line2?:   string;
  city?:    string;
  state?:   string;
  pincode?: string;
  country?: string;
  phone?:   string;
}

export function formatAddressLines(addr: AddressLike): string[] {
  const cityLine =
    addr.city && addr.state
      ? `${addr.city}, ${addr.state} ${addr.pincode ?? ''}`.trimEnd()
      : addr.city || addr.state || '';

  return [
    addr.name,
    addr.line1,
    addr.line2,
    cityLine,
    addr.country || 'India',
  ].filter(Boolean) as string[];
}
