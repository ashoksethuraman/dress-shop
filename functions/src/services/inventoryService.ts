/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as logger from "firebase-functions/logger";
import {db} from "../config/firebase";
import {FieldValue} from "firebase-admin/firestore";

/**
 * Decrements sizeInventory OR ageSizeInventory for each item after a confirmed payment.
 * Non-fatal — failure is logged but does not affect the payment response.
 */
export async function deductInventory(
  orderId: string,
  items: Array<{productId?: unknown; size?: unknown; ageSize?: unknown; qty?: unknown}>
): Promise<void> {
  const byProduct = new Map<string, Array<{size: string | null; ageSize: string | null; qty: number}>>();

  for (const item of items) {
    const productId = typeof item.productId === "string" ? item.productId : null;
    if (!productId) continue;
    const size = typeof item.size === "string" ? item.size : null;
    const ageSize = typeof item.ageSize === "string" ? item.ageSize : null;
    const qty = typeof item.qty === "number" && item.qty > 0 ? item.qty : 0;
    if (!qty) continue;
    if (!byProduct.has(productId)) byProduct.set(productId, []);
    byProduct.get(productId)!.push({size, ageSize, qty});
  }

  await Promise.all(
    Array.from(byProduct.entries()).map(async ([productId, itemQtys]) => {
      const ref = db.doc(`products/${productId}`);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const data = snap.data()!;
          const sizeInv: Record<string, number> = {...(data.sizeInventory ?? {})};
          const ageSizeInv: Record<string, number> = {...(data.ageSizeInventory ?? {})};

          for (const {size, ageSize, qty} of itemQtys) {
            // Handle adult products with sizes
            if (size !== null) {
              if (size === "") {
                // No size specified
                if (typeof sizeInv["__noSize"] === "number") {
                  sizeInv["__noSize"] = Math.max(0, sizeInv["__noSize"] - qty);
                }
              } else if (typeof sizeInv[size] === "number") {
                sizeInv[size] = Math.max(0, sizeInv[size] - qty);
              }
            } else if (ageSize !== null) {
              // Handle children products with age sizes
              if (typeof ageSizeInv[ageSize] === "number") {
                ageSizeInv[ageSize] = Math.max(0, ageSizeInv[ageSize] - qty);
              }
            }
          }

          const unitsSold = itemQtys.reduce((s, x) => s + x.qty, 0);
          tx.update(ref, {
            sizeInventory: sizeInv,
            ageSizeInventory: ageSizeInv,
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
