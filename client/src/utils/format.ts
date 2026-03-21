/**
 * Shared formatting utilities.
 * Import individual functions — tree-shaking will drop unused ones.
 */

/** Format a price value as an Indian Rupee string: ₹1,234.56 */
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

/**
 * Convert a stored address object (AddressPayload schema) into an ordered
 * array of non-empty display lines suitable for rendering or PDF output.
 *
 * Stored schema: { name, line1, line2?, city, state, pincode, country, phone }
 */
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
