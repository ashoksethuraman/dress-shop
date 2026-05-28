/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/** ------------------ IMPORTS ------------------ **/
import {Router, type Request, type Response} from "express";
import {FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

import {db} from "../config/firebase";
import {
  authenticate,
  requireAdmin,
  optionalAuth,
  validate,
} from "../middleware";

import {
  type OrderStatus,
  type CreateOrderBody,
} from "../types";

import {
  validateCreateOrder,
  validateUpdateOrderStatus,
} from "../validators";

import {
  calculateOrderPricing,
} from "../services/pricingService";

import {initiateRefund} from "./refund";

/** ------------------ ROUTER ------------------ **/
export const ordersRouter = Router();

/** ------------------ HELPERS ------------------ **/
function toIso(ts: unknown): string | null {
  if (!ts) return null;

  // ensure object + has "toDate" method
  if (typeof ts === "object" && ts !== null && "toDate" in ts) {
    const value = ts as { toDate: () => Date };
    return value.toDate().toISOString();
  }

  return null;
}

function timelineEvent(status: string, note?: string) {
  return {
    status,
    note: note || status,
    timestamp: new Date().toISOString(),
  };
}

/** ------------------ PRICING + STOCK ------------------ **/
async function validateStockAndPrice(items: CreateOrderBody["items"]) {
  const pricing = await calculateOrderPricing(items);
  return {pricing};
}

/** ------------------ CREATE ORDER ------------------ **/
ordersRouter.post(
  "/",
  optionalAuth,
  validate(validateCreateOrder),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as CreateOrderBody;

      const userId = req.user?.uid ?? `guest_${Date.now()}`;
      const userEmail = req.user?.email ?? body.contactEmail ?? null;

      const {pricing} = await validateStockAndPrice(body.items);

      if (
        body.totalAmount !== undefined &&
        Math.abs(body.totalAmount - pricing.totalAmount) > 1
      ) {
        return res.status(422).json({
          error: "Price mismatch. Please refresh cart.",
        });
      }

      const orderId = body.id ?? db.collection("orders").doc().id;

      const existing = await db.doc(`orders/${orderId}`).get();
      if (existing.exists) {
        return res.status(409).json({error: "Order already exists"});
      }

      const paymentMethod = body.paymentMethod ?? "razorpay";
      const isOffline = paymentMethod === "cod" || paymentMethod === "pay_later";

      await db.doc(`orders/${orderId}`).set({
        id: orderId,
        contactEmail: body.contactEmail,

        billingAddress: body.billingAddress,
        shippingAddress:
          body.billingAndShippingSame === false ?
            body.shippingAddress :
            body.billingAddress,

        billingAndShippingSame: body.billingAndShippingSame,

        items: pricing.items,
        subtotal: pricing.subtotal,
        taxAmount: pricing.taxAmount,
        shippingFee: pricing.shippingFee,
        discount: pricing.discount,
        totalAmount: pricing.totalAmount,

        userId,
        userEmail,
        isGuest: !req.user,

        paymentMethod,
        paymentStatus: "PENDING",
        paymentId: null,

        orderStatus: isOffline ? "PLACED" : "PENDING",

        inventoryDeducted: false,
        emailSent: false,

        timeline: [
          timelineEvent(
            isOffline ? "PLACED" : "PENDING",
            isOffline ?
              `Order placed (${paymentMethod.toUpperCase()})` :
              "Awaiting payment"
          ),
        ],

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return res.status(201).json({
        id: orderId,
        totalAmount: pricing.totalAmount,
      });
    } catch (err: unknown) {
      logger.error(err);
      const message = err instanceof Error ? err.message : "Unknown";
      return res.status(500).json({error: "Failed to create order " + message});
    }
  }
);

/** ------------------ TRACK ORDER ------------------ **/
ordersRouter.get("/track/:id", async (req, res) => {
  try {
    const snap = await db.doc(`orders/${req.params.id}`).get();

    if (!snap.exists) {
      return res.status(404).json({error: "Order not found"});
    }

    const d = snap.data()!;

    return res.json({
      id: snap.id,
      orderStatus: d.orderStatus,
      billingAddress: d.billingAddress,
      shippingAddress: d.shippingAddress,
      paymentStatus: d.paymentStatus,
      paymentMethod: d.paymentMethod,
      totalAmount: d.totalAmount,
      createdAt: toIso(d.createdAt),
      items: d.items ?? [],
    });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({error: "Failed to fetch order"});
  }
});

/** ------------------ GET ORDER BY ID ------------------ **/
ordersRouter.get("/id/:id", authenticate, async (req, res) => {
  try {
    const snap = await db.doc(`orders/${req.params.id}`).get();

    if (!snap.exists) {
      return res.status(404).json({error: "Order not found"});
    }

    const data = snap.data()!;

    if (data.userId !== req.user!.uid && req.user!.role !== "admin") {
      return res.status(403).json({error: "Unauthorized"});
    }

    return res.json({
      id: snap.id,
      ...data,
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
    });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({error: "Failed to fetch order"});
  }
});

/** ------------------ USER ORDERS ------------------ **/
ordersRouter.get("/self", authenticate, async (req, res) => {
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

    return res.json({orders});
  } catch (err) {
    logger.error(err);
    return res.status(500).json({error: "Failed to fetch orders"});
  }
});

/** ------------------ 🔥 NEW: ADMIN LIST ORDERS (FIX YOUR ISSUE) ------------------ **/
ordersRouter.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 10);

    const snap = await db
      .collection("orders")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const orders = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: toIso(d.data().createdAt),
    }));

    return res.json({orders});
  } catch (err) {
    logger.error(err);
    return res.status(500).json({error: "Failed to fetch orders"});
  }
});

/** ------------------ STATUS UPDATE ------------------ **/
const FORWARD_SEQUENCE: OrderStatus[] = [
  "PENDING",
  "PLACED",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

const TERMINAL = new Set<OrderStatus>(["DELIVERED", "CANCELLED"]);

function isValidTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false;
  if (to === "CANCELLED") return from !== "SHIPPED" && from !== "DELIVERED";

  const fi = FORWARD_SEQUENCE.indexOf(from);
  const ti = FORWARD_SEQUENCE.indexOf(to);

  return fi >= 0 && ti > fi;
}

ordersRouter.post(
  "/:id/status",
  authenticate,
  requireAdmin,
  validate(validateUpdateOrderStatus),
  async (req, res) => {
    try {
      const {id} = req.params;
      const {status} = req.body as { status: OrderStatus };

      const ref = db.doc(`orders/${id}`);
      const snap = await ref.get();

      if (!snap.exists) {
        return res.status(404).json({error: "Order not found"});
      }

      const data = snap.data()!;
      const current = data.orderStatus;

      if (!isValidTransition(current, status)) {
        return res.status(422).json({
          error: `Invalid transition ${current} → ${status}`,
        });
      }

      await ref.update({
        orderStatus: status,
        updatedAt: FieldValue.serverTimestamp(),
        timeline: FieldValue.arrayUnion(
          timelineEvent(status, `Updated to ${status}`)
        ),
      });

      return res.json({success: true});
    } catch (err) {
      logger.error(err);
      return res.status(500).json({error: "Failed to update status"});
    }
  }
);

/** ------------------ CANCEL ORDER ------------------ **/
ordersRouter.post("/:id/cancel", optionalAuth, async (req, res) => {
  try {
    const id = req.params.id;

    const snap = await db.doc(`orders/${id}`).get();
    if (!snap.exists) {
      return res.status(404).json({error: "Order not found"});
    }

    const data = snap.data()!;

    if (data.orderStatus === "DELIVERED") {
      return res.status(422).json({error: "Cannot cancel delivered order"});
    }

    if (data.orderStatus === "CANCELLED") {
      return res.status(422).json({error: "Already cancelled"});
    }

    if (
      req.user &&
      data.userId !== req.user.uid &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({error: "Unauthorized"});
    }

    if (data.paymentStatus === "SUCCESS" && data.paymentId) {
      try {
        await initiateRefund(id, data.paymentId);
      } catch (e) {
        logger.error("Refund failed", e);
      }
    }

    await snap.ref.update({
      orderStatus: "CANCELLED",
      updatedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion(
        timelineEvent("CANCELLED", "Order cancelled")
      ),
    });

    return res.json({success: true});
  } catch (err) {
    logger.error(err);
    return res.status(500).json({error: "Cancel failed"});
  }
});

export default ordersRouter;
