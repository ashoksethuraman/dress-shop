import { onRequest } from "firebase-functions/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { setCors, verifyToken, requireAdmin, optionalToken } from "./helpers";
import {
  ORDER_STATUSES, type OrderStatus,
  type CreateOrderBody,
  validateCreateOrder,
  validateUpdateOrderStatus,
} from "./schemas";

// ── POST /apiCreateOrder ────────────────────────────────────────────────────
// Guest-friendly. Token is optional — guests get a generated guestId as userId.
// Body: { id, items, total, shippingAddress, billingAddress, contactEmail, ... }
export const apiCreateOrder = onRequest(async (req, res) => {
  if (setCors(req, res)) return;  logger.info("[apiCreateOrder] →", { method: req.method, total: req.body?.total, itemCount: req.body?.items?.length });  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  // Token is optional: logged-in users get their uid; guests get a stable guestId
  const decoded = await optionalToken(req);

  // Validate request body against the CreateOrderBody schema
  const validation = validateCreateOrder(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error, field: validation.field });
    return;
  }
  const body = req.body as CreateOrderBody;

  const userId    = decoded?.uid ?? `guest_${Date.now()}`;
  const userEmail = decoded?.email ?? (body.contactEmail as string) ?? null;

  try {
    const orderId = body.id || admin.firestore().collection("orders").doc().id;

    // Build the Firestore document — all status/timeline fields set server-side only
    const orderDoc = {
      id:               orderId,
      contactEmail:     body.contactEmail,
      billingAddress:   body.billingAddress,
      ...(body.shippingAddress ? { shippingAddress: body.shippingAddress } : {}),
      items:            body.items,
      subtotal:         body.subtotal,
      taxAmount:        body.taxAmount,
      shippingFee:      body.shippingFee,
      discount:         body.discount,
      totalAmount:      body.totalAmount,
      userId,
      userEmail,
      isGuest:          !decoded,
      orderStatus:      "PENDING" as OrderStatus,
      paymentStatus:    "PENDING",
      paymentId:        null,
      timeline:         [{ status: "PENDING", note: "Awaiting payment", timestamp: new Date().toISOString() }],
      createdAt:        FieldValue.serverTimestamp(),
      updatedAt:        FieldValue.serverTimestamp(),
    };

    await admin.firestore().doc(`orders/${orderId}`).set(orderDoc);

    logger.info(`Order created: ${orderId} by ${userId}, totalAmount: ${body.totalAmount}`);
    res.status(201).json({ id: orderId });
  } catch (err) {
    logger.error("createOrder error", err);
    res.status(500).json({ error: "Failed to create order." });
  }
});

// ── GET /apiGetMyOrders ─────────────────────────────────────────────────────
// Authenticated. Returns all orders belonging to the current user.
export const apiGetMyOrders = onRequest(async (req, res) => {
  if (setCors(req, res)) return;  logger.info("[apiGetMyOrders] →", { method: req.method });  if (req.method !== "GET") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  try {
    const snap = await admin.firestore()
      .collection("orders")
      .where("userId", "==", decoded.uid)
      .orderBy("createdAt", "desc")
      .get();

    const orders = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as admin.firestore.Timestamp)?.toDate?.()?.toISOString() ?? null,
    }));

    res.json({ orders });
  } catch (err) {
    logger.error("getMyOrders error", err);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// ── GET /apiGetAllOrders ────────────────────────────────────────────────────
// Admin only. Returns all orders with optional status filter (?status=pending).
export const apiGetAllOrders = onRequest(async (req, res) => {
  if (setCors(req, res)) return;  logger.info("[apiGetAllOrders] →", { method: req.method, statusFilter: req.query.status });  if (req.method !== "GET") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await verifyToken(req, res);
  if (!decoded) return;
  if (!requireAdmin(decoded, res)) return;

  const statusFilter = req.query.status as string | undefined;
  const limit        = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const lastDocId    = req.query.lastDocId as string | undefined;

  try {
    let query: admin.firestore.Query = admin.firestore()
      .collection("orders")
      .orderBy("createdAt", "desc");

    if (statusFilter && (ORDER_STATUSES as readonly string[]).includes(statusFilter)) {
      query = admin.firestore()
        .collection("orders")
        .where("orderStatus", "==", statusFilter)
        .orderBy("createdAt", "desc");
    }

    // Cursor-based pagination: client passes lastDocId of the previous page
    if (lastDocId) {
      const cursorDoc = await admin.firestore().doc(`orders/${lastDocId}`).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    // Fetch one extra to detect whether another page exists
    const snap    = await query.limit(limit + 1).get();
    const hasMore = snap.docs.length > limit;
    const docs    = hasMore ? snap.docs.slice(0, limit) : snap.docs;

    const orders = docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as admin.firestore.Timestamp)?.toDate?.()?.toISOString() ?? null,
    }));

    res.json({ orders, hasMore });
  } catch (err) {
    logger.error("getAllOrders error", err);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// ── GET /apiGetOrderById?id=<orderId> ──────────────────────────────────────
// Authenticated. Users can only fetch their own orders; admins can fetch any.
export const apiGetOrderById = onRequest(async (req, res) => {
  if (setCors(req, res)) return;  logger.info("[apiGetOrderById] →", { method: req.method, id: req.query.id });  if (req.method !== "GET") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  const id = req.query.id as string;
  if (!id) { res.status(400).json({ error: "id query param required." }); return; }

  try {
    const snap = await admin.firestore().doc(`orders/${id}`).get();
    if (!snap.exists) { res.status(404).json({ error: "Order not found." }); return; }

    const data = snap.data()!;
    if (data.userId !== decoded.uid && !decoded["isAdmin"]) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    res.json({
      id: snap.id,
      ...data,
      createdAt: (data.createdAt as admin.firestore.Timestamp)?.toDate?.()?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error("getOrderById error", err);
    res.status(500).json({ error: "Failed to fetch order." });
  }
});

// ── POST /apiUpdateOrderStatus ──────────────────────────────────────────────
// Admin only. Body: { orderId: string, status: OrderStatus }
export const apiUpdateOrderStatus = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiUpdateOrderStatus] →", { method: req.method, orderId: req.body?.orderId, status: req.body?.status });
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await verifyToken(req, res);
  if (!decoded) return;
  if (!requireAdmin(decoded, res)) return;

  const validation = validateUpdateOrderStatus(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error, field: validation.field });
    return;
  }
  const { orderId, status } = req.body as { orderId: string; status: string };

  try {
    await admin.firestore().doc(`orders/${orderId}`).update({
      orderStatus: status,
      updatedAt:   FieldValue.serverTimestamp(),
      timeline:    FieldValue.arrayUnion({ status, timestamp: new Date().toISOString() }),
    });
    logger.info(`Order ${orderId} orderStatus → ${status} by admin ${decoded.uid}`);
    res.json({ success: true });
  } catch (err) {
    logger.error("updateOrderStatus error", err);
    res.status(500).json({ error: "Failed to update order status." });
  }
});

// ── GET /apiTrackOrder?id=<orderId> ────────────────────────────────────────
// Public endpoint — no auth required. Returns only safe tracking data:
// status, items (title/qty/price), total, shipping address, createdAt.
// Does NOT expose userId, userEmail, contactEmail, billingAddress, or paymentId.
export const apiTrackOrder = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiTrackOrder] →", { method: req.method, id: req.query.id });
  if (req.method !== "GET") { res.status(405).send("Method Not Allowed"); return; }

  const id = (req.query.id as string)?.trim();
  if (!id) { res.status(400).json({ error: "id query param required." }); return; }

  try {
    const snap = await admin.firestore().doc(`orders/${id}`).get();
    if (!snap.exists) { res.status(404).json({ error: "Order not found." }); return; }

    const d = snap.data()!;

    // Optionally fetch payment method from the payments ledger (best-effort)
    let paymentMethod: string | null = null;
    if (d.paymentId) {
      try {
        const paySnap = await admin.firestore().doc(`payments/${d.paymentId}`).get();
        if (paySnap.exists) paymentMethod = paySnap.data()?.method ?? null;
      } catch { /* non-fatal — tracking works without it */ }
    }

    // Return only tracking-safe fields — never expose PII or payment internals
    res.json({
      id:            snap.id,
      orderStatus:   d.orderStatus ?? "PLACED",
      paymentStatus: d.paymentStatus ?? "PENDING",
      paymentMethod,
      totalAmount:   d.totalAmount ?? 0,
      createdAt:     (d.createdAt as admin.firestore.Timestamp)?.toDate?.()?.toISOString() ?? null,
      shippingAddress: d.shippingAddress ?? d.billingAddress ?? null,
      items: Array.isArray(d.items)
        ? d.items.map((it: Record<string, unknown>) => ({
            productId: it.productId,
            title:     it.title,
            qty:       it.qty,
            unitPrice: it.unitPrice,
            total:     it.total,
            size:      it.size ?? null,
          }))
        : [],
    });
  } catch (err) {
    logger.error("trackOrder error", err);
    res.status(500).json({ error: "Failed to fetch order." });
  }
});
