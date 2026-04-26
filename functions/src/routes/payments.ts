/** ------------------ IMPORTS ------------------ **/
import { Router, type Request, type Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import fetch from "node-fetch";

import { db } from "../config/firebase";
import { optionalAuth, validate } from "../middleware";

import {
  sendOrderEmail,
  type OrderEmailPayload,
} from "../services/emailService";
import { deductInventory } from "../services/inventoryService";

import {
  type VerifyPaymentBody,
  type CreateRazorpayOrderBody,
} from "../types";

import {
  validateVerifyPayment,
  validateCreateRazorpayOrder,
} from "../validators";

/** ------------------ TIMELINE ------------------ **/
function timelineEvent(status: string, note?: string) {
  return {
    status,
    note: note || status,
    timestamp: new Date().toISOString(),
  };
}

/** ------------------ ROUTER ------------------ **/
export const paymentsRouter = Router();

/** ------------------ ENV ------------------ **/
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
const enforceSignature = process.env.ENFORCE_RAZORPAY_SIGNATURE !== "false";

/** ------------------ TYPES ------------------ **/
interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  method?: string;
}

/** ------------------ HELPERS ------------------ **/
function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function toEmailPayload(
  orderId: string,
  data: any,
  paymentId?: string
): OrderEmailPayload {
  return {
    orderId,
    isGuest: data?.isGuest ?? false,
    contactEmail: data?.contactEmail ?? data?.email ?? null,
    userEmail: data?.userEmail ?? null,
    totalAmount: data?.totalAmount ?? data?.amount ?? 0,
    amount: data?.totalAmount ?? data?.amount ?? 0,
    paymentId: paymentId ?? data?.paymentId ?? null,
    paymentStatus: data?.paymentStatus ?? null,
    orderStatus: data?.orderStatus ?? null,
    items: data?.items ?? [],
    billingAddress: data?.billingAddress,
    shippingAddress: data?.shippingAddress,
  };
}

/** ------------------ RAZORPAY FETCH ------------------ **/
async function validatePaymentFromRazorpay(
  paymentId: string
): Promise<RazorpayPayment> {
  const auth = Buffer.from(
    `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
  ).toString("base64");

  const res = await fetch(
    `https://api.razorpay.com/v1/payments/${paymentId}`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  if (!res.ok) throw new Error("Razorpay API fetch failed");
  return (await res.json()) as RazorpayPayment;
}

/** ------------------ CONFIRM PAYMENT ------------------ **/
async function confirmPayment({
  orderId,
  paymentId,
  razorpayOrderId,
  paymentMethod,
  paymentMeta,
}: {
  orderId: string;
  paymentId: string;
  razorpayOrderId?: string;
  paymentMethod?: string;
  paymentMeta?: any;
}) {
  return db.runTransaction(async (tx) => {
    const orderRef = db.doc(`orders/${orderId}`);
    const paymentRef = db.doc(`payments/${paymentId}`);

    const orderSnap = await tx.get(orderRef);
    const paymentSnap = await tx.get(paymentRef);

    if (!orderSnap.exists) throw new Error("NOT_FOUND");

    const orderData = orderSnap.data()!;

    if (paymentSnap.exists || orderData.paymentStatus === "SUCCESS") {
      return { shouldProcess: false };
    }

    tx.update(orderRef, {
      paymentStatus: "SUCCESS",
      orderStatus: "PLACED",
      paymentId,
      paymentMethod: paymentMethod ?? "online",
      updatedAt: FieldValue.serverTimestamp(),

      timeline: FieldValue.arrayUnion(
        timelineEvent("PAYMENT_SUCCESS"),
        timelineEvent("ORDER_PLACED")
      ),
    });

    tx.set(paymentRef, {
      orderId,
      providerPaymentId: paymentId,
      providerOrderId: razorpayOrderId ?? null,
      status: "SUCCESS",
      paymentMethod,
      paymentMeta,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { shouldProcess: true };
  });
}

/** ------------------ ROUTES ------------------ **/

/* CREATE RAZORPAY ORDER (RESTORED) */
paymentsRouter.post(
  "/razorpay-order",
  validate(validateCreateRazorpayOrder),
  async (req, res) => {
    try {
      const { orderId } = req.body as CreateRazorpayOrderBody;

      const ref = db.doc(`orders/${orderId}`);
      const snap = await ref.get();

      if (!snap.exists)
        return res.status(404).json({ error: "Order not found" });

      const data = snap.data()!;
      const amount = data.totalAmount;

      if (!amount || amount <= 0)
        return res.status(422).json({ error: "Invalid amount" });

      if (data.razorpayOrderId) {
        return res.json({
          razorpayOrderId: data.razorpayOrderId,
          amount: Math.round(amount * 100),
          currency: "INR",
          keyId: RAZORPAY_KEY_ID,
        });
      }

      const auth = Buffer.from(
        `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
      ).toString("base64");

      const r = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency: "INR",
          receipt: orderId,
          notes: { orderId },
        }),
      });

      const json: any = await r.json();

      if (!r.ok) {
        logger.error("Razorpay order creation failed", json);
        return res.status(500).json({ error: "Razorpay failed" });
      }

      await ref.update({
        razorpayOrderId: json.id,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return res.json({
        razorpayOrderId: json.id,
        amount: json.amount,
        currency: json.currency,
        keyId: RAZORPAY_KEY_ID,
      });
    } catch (err) {
      logger.error("razorpay-order error", err);
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

/* VERIFY PAYMENT */
paymentsRouter.post(
  "/verify",
  optionalAuth,
  validate(validateVerifyPayment),
  async (req, res) => {
    try {
      const body = req.body as VerifyPaymentBody;

      if (enforceSignature) {
        const expected = crypto
          .createHmac("sha256", RAZORPAY_KEY_SECRET)
          .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
          .digest("hex");

        if (!safeEqual(expected, body.razorpay_signature))
          return res.status(400).json({ error: "Invalid signature" });
      }

      const payment = await validatePaymentFromRazorpay(
        body.razorpay_payment_id
      );

      if (payment.status !== "captured")
        return res.status(400).json({ error: "Not captured" });

      const result = await confirmPayment({
        orderId: body.orderId,
        paymentId: body.razorpay_payment_id,
        razorpayOrderId: body.razorpay_order_id,
        paymentMethod: payment.method,
        paymentMeta: payment,
      });

      const updated = await db.doc(`orders/${body.orderId}`).get();
      const data = updated.data()!;

      if (result.shouldProcess) {
        try {
          if (!data.inventoryDeducted) {
            await deductInventory(body.orderId, data.items || []);
            await updated.ref.update({
              inventoryDeducted: true,
              timeline: FieldValue.arrayUnion(
                timelineEvent("INVENTORY_DEDUCTED")
              ),
            });
          }
        } catch (e) {
          logger.error("Inventory failed", e);
        }

        try {
          if (!data.emailSent) {
            await sendOrderEmail(
              "payment_success",
              toEmailPayload(body.orderId, data, body.razorpay_payment_id)
            );
            await updated.ref.update({
              emailSent: true,
              timeline: FieldValue.arrayUnion(
                timelineEvent("EMAIL_SENT")
              ),
            });
          }
        } catch (e) {
          logger.error("Email failed", e);
        }
      }

      return res.json({ success: true });
    } catch (err: any) {
      logger.error("VERIFY FAILED", err);
      return res.status(500).json({ error: "Verification failed" });
    }
  }
);

/* FAIL */
paymentsRouter.post("/fail", optionalAuth, async (req, res) => {
  try {
    const { orderId } = req.body;

    await db.doc(`orders/${orderId}`).update({
      paymentStatus: "FAILED",
      orderStatus: "PAYMENT_FAILED",
      updatedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion(
        timelineEvent("PAYMENT_FAILED")
      ),
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Failed" });
  }
});

/* REFUND (SAFE) */
paymentsRouter.post("/refund", optionalAuth, async (req, res) => {
  try {
    const { orderId } = req.body;

    const snap = await db.doc(`orders/${orderId}`).get();
    if (!snap.exists)
      return res.status(404).json({ error: "Order not found" });

    const data = snap.data()!;

    if (data.paymentStatus !== "SUCCESS")
      return res.status(400).json({ error: "No successful payment" });

    if (["REFUND_INITIATED", "REFUNDED"].includes(data.paymentStatus))
      return res.status(400).json({ error: "Already refunded" });

    if (!data.paymentId)
      return res.status(400).json({ error: "Missing paymentId" });

    const Razorpay = require("razorpay");
    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    const refund = await razorpay.payments.refund(data.paymentId, {
      amount: data.totalAmount * 100,
      notes: { orderId },
    });

    await snap.ref.update({
      paymentStatus: "REFUND_INITIATED",
      orderStatus: "REFUND_INITIATED",
      timeline: FieldValue.arrayUnion(
        timelineEvent("REFUND_INITIATED"),
        timelineEvent("REFUND_REQUESTED")
      ),
    });

    return res.json({ success: true, refundId: refund.id });
  } catch (err: any) {
    logger.error("Refund failed", err);
    return res.status(500).json({ error: err.message });
  }
});

/* WEBHOOK (IMPORTANT: USE RAW BODY IN EXPRESS) */
export async function razorpayWebhookHandler(
  req: Request,
  res: Response
) {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;

    const raw = req.body as Buffer;

    const expected = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(raw)
      .digest("hex");

    if (!safeEqual(expected, signature))
      return res.status(400).json({ error: "Invalid signature" });

    const event = JSON.parse(raw.toString());

    if (event.event === "payment.captured") {
      const entity = event.payload.payment.entity;
      const orderId = entity.notes?.orderId;

      if (!orderId) return res.json({ skip: true });

      const result = await confirmPayment({
        orderId,
        paymentId: entity.id,
        razorpayOrderId: entity.order_id,
        paymentMethod: entity.method,
        paymentMeta: entity,
      });

      if (result.shouldProcess) {
        const doc = await db.doc(`orders/${orderId}`).get();
        const order = doc.data()!;

        if (!order.inventoryDeducted) {
          await deductInventory(orderId, order.items || []);
          await doc.ref.update({
            inventoryDeducted: true,
            timeline: FieldValue.arrayUnion(
              timelineEvent("INVENTORY_DEDUCTED")
            ),
          });
        }

        if (!order.emailSent) {
          await sendOrderEmail(
            "payment_success",
            toEmailPayload(orderId, order, entity.id)
          );
          await doc.ref.update({
            emailSent: true,
            timeline: FieldValue.arrayUnion(
              timelineEvent("EMAIL_SENT")
            ),
          });
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    logger.error("Webhook failed", err);
    return res.status(500).json({ error: "Webhook failed" });
  }
}

export default paymentsRouter;