/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as logger from "firebase-functions/logger";
import {db} from "../config/firebase";
import {FieldValue} from "firebase-admin/firestore";

/**
 * Decrements sizeInventory for each item after a confirmed payment.
 * Non-fatal — failure is logged but does not affect the payment response.
 */
export async function deductInventory(
  orderId: string,
  items: Array<{productId?: unknown; size?: unknown; qty?: unknown}>
): Promise<void> {
  const byProduct = new Map<string, Array<{size: string | null; qty: number}>>();

  for (const item of items) {
    const productId = typeof item.productId === "string" ? item.productId : null;
    if (!productId) continue;
    const size = typeof item.size === "string" ? item.size : null;
    const qty = typeof item.qty === "number" && item.qty > 0 ? item.qty : 0;
    if (!qty) continue;
    if (!byProduct.has(productId)) byProduct.set(productId, []);
    byProduct.get(productId)!.push({size, qty});
  }

  await Promise.all(
    Array.from(byProduct.entries()).map(async ([productId, sizeQtys]) => {
      const ref = db.doc(`products/${productId}`);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const data = snap.data()!;
          const inv: Record<string, number> = {...(data.sizeInventory ?? {})};

          for (const {size, qty} of sizeQtys) {
            if (size === null) {
              if (typeof inv["__noSize"] === "number") {
                inv["__noSize"] = Math.max(0, inv["__noSize"] - qty);
              }
            } else if (typeof inv[size] === "number") {
              inv[size] = Math.max(0, inv[size] - qty);
            }
          }

          const unitsSold = sizeQtys.reduce((s, x) => s + x.qty, 0);
          tx.update(ref, {
            sizeInventory: inv,
            salesCount: ((data.salesCount as number | undefined) ?? 0) + unitsSold,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        logger.info(`[deductInventory] product ${productId} updated for order ${orderId}`);
      } catch (err) {
        logger.error(`[deductInventory] failed for product ${productId}`, err);
      }
    })
  );
}
