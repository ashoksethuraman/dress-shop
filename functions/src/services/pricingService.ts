import {db} from "../config/firebase";
import type {CreateOrderBody} from "../types/order";

// ── Pricing constants (must stay in sync with client/src/utils/priceLevel.ts) ─
export const TAX_RATE = 0.18; // 18% GST
export const SHIPPING_FEE = 49; // flat ₹49
export const FREE_SHIPPING = 999; // free above this subtotal
export const MAX_QTY_PER_ITEM = 10;

export interface PricedItem {
  productId: string;
  title: string;
  qty: number;
  unitPrice: number;
  total: number;
  size: string | null;
}

export interface OrderPricing {
  items: PricedItem[];
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  discount: number;
  totalAmount: number;
}

/**
 * Fetch authoritative prices from Firestore and compute all order totals.
 * Client-supplied prices are ignored — only productId, qty, and size matter.
 * Throws (400/422) if a qty cap is exceeded or a product is not found.
 */
export async function calculateOrderPricing(
  items: CreateOrderBody["items"]
): Promise<OrderPricing> {
  for (const item of items) {
    if (item.qty > MAX_QTY_PER_ITEM) {
      throw Object.assign(
        new Error(`Quantity for "${item.productId}" exceeds the maximum of ${MAX_QTY_PER_ITEM}.`),
        {status: 400, field: "items"}
      );
    }
  }

  const uniqueIds = Array.from(new Set(items.map((i) => i.productId)));
  const snapshots = await Promise.all(uniqueIds.map((id) => db.doc(`products/${id}`).get()));

  const productMap = new Map<string, Record<string, unknown>>();
  for (const snap of snapshots) {
    if (snap.exists) productMap.set(snap.id, snap.data() as Record<string, unknown>);
  }

  const pricedItems: PricedItem[] = [];
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw Object.assign(
        new Error(`Product "${item.productId}" not found.`),
        {status: 422, field: "items"}
      );
    }
    const unitPrice =
      typeof product.price === "number" && product.price >= 0 ? product.price : 0;
    const title =
      typeof product.title === "string" && product.title.trim().length > 0 ?
        product.title.trim() :
        item.title;
    const size =
      typeof item.size === "string" && item.size.trim().length > 0 ?
        item.size.trim() :
        null;

    pricedItems.push({
      productId: item.productId, title, qty: item.qty,
      unitPrice, total: parseFloat((unitPrice * item.qty).toFixed(2)), size,
    });
  }

  const subtotal = parseFloat(pricedItems.reduce((acc, i) => acc + i.total, 0).toFixed(2));
  const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const shippingFee = subtotal >= FREE_SHIPPING ? 0 : SHIPPING_FEE;
  const discount = 0; // future: apply coupon logic here
  const totalAmount = parseFloat((subtotal + taxAmount + shippingFee - discount).toFixed(2));

  return {items: pricedItems, subtotal, taxAmount, shippingFee, discount, totalAmount};
}
