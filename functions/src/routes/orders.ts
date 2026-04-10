import {Router, type Request, type Response} from "express";
import {FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../firebase";
import {authenticate, requireAdmin, optionalAuth, validate} from "../middleware";
import {
  ORDER_STATUSES,
  type OrderStatus,
  type CreateOrderBody,
  validateCreateOrder,
} from "../schemas";

export const ordersRouter = Router();

type StockIssueReason =
  | "not_found"
  | "out_of_stock"
  | "size_unavailable"
  | "insufficient_stock";

interface StockValidationIssue {
  productId: string;
  title: string;
  reason: StockIssueReason;
  size?: string | null;
  requestedQty?: number;
  availableQty?: number;
}

async function validateOrderStock(items: CreateOrderBody["items"]): Promise<StockValidationIssue[]> {
  const requested = new Map<string, {productId: string; size: string | null; qty: number; title: string}>();
  for (const item of items) {
    const size = typeof item.size === "string" && item.size.trim().length > 0 ? item.size.trim() : null;
    const key = `${item.productId}::${size ?? "__noSize"}`;
    const prev = requested.get(key);
    if (prev) {
      prev.qty += item.qty;
    } else {
      requested.set(key, {productId: item.productId, size, qty: item.qty, title: item.title});
    }
  }

  const productIds = Array.from(new Set(Array.from(requested.values()).map((r) => r.productId)));
  const products = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  await Promise.all(productIds.map(async (productId) => {
    const snap = await db.doc(`products/${productId}`).get();
    products.set(productId, snap);
  }));

  const issues: StockValidationIssue[] = [];

  for (const reqItem of requested.values()) {
    const snap = products.get(reqItem.productId);
    if (!snap || !snap.exists) {
      issues.push({
        productId: reqItem.productId,
        title: reqItem.title,
        reason: "not_found",
        size: reqItem.size,
        requestedQty: reqItem.qty,
      });
      continue;
    }

    const product = snap.data() as Record<string, unknown>;
    const resolvedTitle = typeof product.title === "string" && product.title.trim().length > 0 ? product.title : reqItem.title;

    if (product.stock === "out_of_stock") {
      issues.push({
        productId: reqItem.productId,
        title: resolvedTitle,
        reason: "out_of_stock",
        size: reqItem.size,
        requestedQty: reqItem.qty,
      });
      continue;
    }

    const inv = (product.sizeInventory ?? {}) as Record<string, unknown>;
    const sizes = Array.isArray(product.sizes) ? (product.sizes as unknown[]) : [];

    if (reqItem.size !== null) {
      const hasSize = sizes.length === 0 || sizes.includes(reqItem.size);
      if (!hasSize) {
        issues.push({
          productId: reqItem.productId,
          title: resolvedTitle,
          reason: "size_unavailable",
          size: reqItem.size,
          requestedQty: reqItem.qty,
        });
        continue;
      }

      const available = inv[reqItem.size];
      if (typeof available === "number") {
        if (available <= 0) {
          issues.push({
            productId: reqItem.productId,
            title: resolvedTitle,
            reason: "out_of_stock",
            size: reqItem.size,
            requestedQty: reqItem.qty,
            availableQty: 0,
          });
          continue;
        }
        if (reqItem.qty > available) {
          issues.push({
            productId: reqItem.productId,
            title: resolvedTitle,
            reason: "insufficient_stock",
            size: reqItem.size,
            requestedQty: reqItem.qty,
            availableQty: available,
          });
          continue;
        }
      }
    } else if (typeof inv["__noSize"] === "number") {
      const available = inv["__noSize"] as number;
      if (available <= 0) {
        issues.push({
          productId: reqItem.productId,
          title: resolvedTitle,
          reason: "out_of_stock",
          requestedQty: reqItem.qty,
          availableQty: 0,
        });
        continue;
      }
      if (reqItem.qty > available) {
        issues.push({
          productId: reqItem.productId,
          title: resolvedTitle,
          reason: "insufficient_stock",
          requestedQty: reqItem.qty,
          availableQty: available,
        });
      }
    }
  }

  return issues;
}

function toIso(ts: unknown): string | null {
  return (ts as FirebaseFirestore.Timestamp)?.toDate?.()?.toISOString() ?? null;
}

ordersRouter.post(
  "/",
  optionalAuth,
  validate(validateCreateOrder),
  async (req: Request, res: Response) => {
    const body = req.body as CreateOrderBody;
    const userId = req.user?.uid ?? `guest_${Date.now()}`;
    const userEmail = req.user?.email ?? body.contactEmail ?? null;

    try {
      const issues = await validateOrderStock(body.items);
      if (issues.length > 0) {
        res.status(422).json({
          error: "Some items in your cart are unavailable or no longer in stock.",
          issues,
        });
        return;
      }

      const orderId = body.id ?? db.collection("orders").doc().id;

      await db.doc(`orders/${orderId}`).set({
        id: orderId,
        contactEmail: body.contactEmail,
        billingAddress: body.billingAddress,
        ...(!body.billingAndShippingSame && body.shippingAddress ?
          {shippingAddress: body.shippingAddress} :
          {}),
        billingAndShippingSame: body.billingAndShippingSame,
        items: body.items,
        subtotal: body.subtotal,
        taxAmount: body.taxAmount,
        shippingFee: body.shippingFee,
        discount: body.discount,
        totalAmount: body.totalAmount,
        userId,
        userEmail,
        isGuest: !req.user,
        orderStatus: "PENDING" as OrderStatus,
        paymentStatus: "PENDING",
        paymentId: null,
        timeline: [{status: "PENDING", note: "Awaiting payment", timestamp: new Date().toISOString()}],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info(`[POST /orders] Created: ${orderId} by ${userId}, total: ${body.totalAmount}`);
      res.status(201).json({id: orderId});
    } catch (err) {
      logger.error("[POST /orders] error", err);
      res.status(500).json({error: "Failed to create order."});
    }
  }
);

ordersRouter.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await db
      .collection("orders")
      .where("userId", "==", req.user!.uid)
      .orderBy("createdAt", "desc")
      .get();

    const orders = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: toIso(d.data().createdAt),
    }));

    res.json({orders});
  } catch (err) {
    logger.error("[GET /orders/me] error", err);
    res.status(500).json({error: "Failed to fetch orders."});
  }
});

ordersRouter.get("/", authenticate, requireAdmin, async (req: Request, res: Response) => {
  const statusFilter = req.query.status as string | undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const lastDocId = req.query.lastDocId as string | undefined;

  try {
    let query: FirebaseFirestore.Query = db.collection("orders").orderBy("createdAt", "desc");

    if (statusFilter && (ORDER_STATUSES as readonly string[]).includes(statusFilter)) {
      query = db
        .collection("orders")
        .where("orderStatus", "==", statusFilter)
        .orderBy("createdAt", "desc");
    }

    if (lastDocId) {
      const cursor = await db.doc(`orders/${lastDocId}`).get();
      if (cursor.exists) query = query.startAfter(cursor);
    }

    const snap = await query.limit(limit + 1).get();
    const hasMore = snap.docs.length > limit;
    const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;

    const orders = docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: toIso(d.data().createdAt),
    }));

    res.json({orders, hasMore});
  } catch (err) {
    logger.error("[GET /orders] error", err);
    res.status(500).json({error: "Failed to fetch orders."});
  }
});

ordersRouter.get("/track/:id", async (req: Request, res: Response) => {
  const {id} = req.params;
  try {
    const snap = await db.doc(`orders/${id}`).get();
    if (!snap.exists) {
      res.status(404).json({error: "Order not found."}); return;
    }

    const d = snap.data()!;

    let paymentMethod: string | null = null;
    if (d.paymentId) {
      try {
        const pSnap = await db.doc(`payments/${d.paymentId}`).get();
        if (pSnap.exists) paymentMethod = (pSnap.data()?.method as string | null) ?? null;
      } catch {/* non‑fatal — tracking works without payment details */}
    }

    res.json({
      id: snap.id,
      orderStatus: d.orderStatus ?? "PLACED",
      paymentStatus: d.paymentStatus ?? "PENDING",
      paymentMethod,
      totalAmount: d.totalAmount ?? 0,
      createdAt: toIso(d.createdAt),
      shippingAddress: d.shippingAddress ?? d.billingAddress ?? null,
      items: Array.isArray(d.items) ?
        (d.items as Record<string, unknown>[]).map((it) => ({
          productId: it.productId,
          title: it.title,
          qty: it.qty,
          unitPrice: it.unitPrice,
          total: it.total,
          size: it.size ?? null,
        })) :
        [],
    });
  } catch (err) {
    logger.error("[GET /orders/track/:id] error", err);
    res.status(500).json({error: "Failed to fetch order."});
  }
});

ordersRouter.get("/:id", authenticate, async (req: Request, res: Response) => {
  const {id} = req.params;
  try {
    const snap = await db.doc(`orders/${id}`).get();
    if (!snap.exists) {
      res.status(404).json({error: "Order not found."}); return;
    }

    const data = snap.data()!;
    if (data.userId !== req.user!.uid && req.user!.role !== "admin") {
      res.status(403).json({error: "Access denied."});
      return;
    }

    res.json({id: snap.id, ...data, createdAt: toIso(data.createdAt)});
  } catch (err) {
    logger.error("[GET /orders/:id] error", err);
    res.status(500).json({error: "Failed to fetch order."});
  }
});

ordersRouter.post(
  "/:id/status",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    const {id} = req.params;
    const {status} = req.body as { status?: string };

    if (!status || !(ORDER_STATUSES as readonly string[]).includes(status)) {
      res.status(400).json({
        error: `status must be one of: ${ORDER_STATUSES.join(", ")}.`,
        field: "status",
      });
      return;
    }

    try {
      await db.doc(`orders/${id}`).update({
        orderStatus: status,
        updatedAt: FieldValue.serverTimestamp(),
        timeline: FieldValue.arrayUnion({status, timestamp: new Date().toISOString()}),
      });
      logger.info(`[POST /orders/:id/status] ${id} → ${status} by ${req.user!.uid}`);
      res.json({success: true});
    } catch (err) {
      logger.error("[POST /orders/:id/status] error", err);
      res.status(500).json({error: "Failed to update order status."});
    }
  }
);
