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
  type FailPaymentBody,
  type CreateRazorpayOrderBody,
} from "../types";

import {
  validateVerifyPayment,
  validateFailPayment,
  validateCreateRazorpayOrder,
} from "../validators";

export const paymentsRouter = Router();

/** ------------------ ENV ------------------ **/
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
const enforceSignature =
  process.env.ENFORCE_RAZORPAY_SIGNATURE !== "false";

/** ------------------ TYPES ------------------ **/
interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  method?: string;
  email?: string;
  contact?: string;
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
    isGuest: data.isGuest ?? false,
    contactEmail: data.contactEmail ?? null,
    userEmail: data.userEmail ?? null,
    totalAmount: data.totalAmount ?? 0,
    paymentId: paymentId ?? data.paymentId ?? null,
    paymentStatus: data.paymentStatus ?? null,
    orderStatus: data.orderStatus ?? null,
    items: data.items ?? [],
    billingAddress: data.billingAddress,
    shippingAddress: data.shippingAddress,
  };
}

/** ------------------ RAZORPAY SERVER VALIDATION ------------------ **/
async function validatePaymentFromRazorpay(
  paymentId: string
): Promise<RazorpayPayment> {
  const auth = Buffer.from(
    `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
  ).toString("base64");

  const res = await fetch(
    `https://api.razorpay.com/v1/payments/${paymentId}`,
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  if (!res.ok) throw new Error("Razorpay API fetch failed");

  return (await res.json()) as RazorpayPayment;
}

/** ------------------ TRANSACTION (IDEMPOTENT) ------------------ **/
async function confirmPayment({
  orderId,
  paymentId,
  razorpayOrderId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  razorpayOrderId?: string;
  signature?: string;
}) {
  return db.runTransaction(async (tx) => {
    const orderRef = db.doc(`orders/${orderId}`);
    const paymentRef = db.doc(`payments/${paymentId}`);

    const orderSnap = await tx.get(orderRef);
    const paymentSnap = await tx.get(paymentRef);

    if (!orderSnap.exists) throw new Error("NOT_FOUND");

    const orderData = orderSnap.data()!;

    // Idempotency checks
    if (paymentSnap.exists)
      return { shouldProcess: false, reason: "PAYMENT_ALREADY_PROCESSED" };

    if (orderData.paymentStatus === "SUCCESS")
      return { shouldProcess: false, reason: "ORDER_ALREADY_PAID" };

    // Update order
    tx.update(orderRef, {
      paymentStatus: "SUCCESS",
      orderStatus: "PLACED",
      paymentId,
      updatedAt: FieldValue.serverTimestamp(),
      inventoryDeducted: orderData.inventoryDeducted ?? false,
      emailSent: orderData.emailSent ?? false,
    });

    // Insert payment record
    tx.set(paymentRef, {
      orderId,
      providerPaymentId: paymentId,
      providerOrderId: razorpayOrderId ?? null,
      signature: signature ?? null,
      status: "SUCCESS",
      createdAt: FieldValue.serverTimestamp(),
    });

    return { shouldProcess: true, data: orderData };
  });
}

/** ------------------ ROUTES ------------------ **/

/* 1. CREATE Razorpay Order */
paymentsRouter.post(
  "/razorpay-order",
  validate(validateCreateRazorpayOrder),
  async (req, res) => {
    try {
      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET)
        return res.status(503).json({ error: "Payment not configured" });

      const { orderId } = req.body as CreateRazorpayOrderBody;
      const orderRef = db.doc(`orders/${orderId}`);
      const snap = await orderRef.get();

      if (!snap.exists)
        return res.status(404).json({ error: "Order not found" });

      const data = snap.data()!;
      const amount = data.totalAmount;

      if (!amount || amount <= 0)
        return res.status(422).json({ error: "Invalid amount" });

      // Reuse existing Razorpay order
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

      const json = await r.json();

      if (!r.ok) {
        logger.error("Razorpay create order error", json);
        return res.status(500).json({ error: "Razorpay failed" });
      }

      await orderRef.update({
        razorpayOrderId: json.id,
        updatedAt: FieldValue.serverTimestamp(),
      });

      res.json({
        razorpayOrderId: json.id,
        amount: json.amount,
        currency: json.currency,
        keyId: RAZORPAY_KEY_ID,
      });
    } catch (err) {
      logger.error("razorpay-order error", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/* 2. VERIFY Payment */
paymentsRouter.post(
  "/verify",
  optionalAuth,
  validate(validateVerifyPayment),
  async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        orderId,
      } = req.body as VerifyPaymentBody;

      /** Signature verification */
      if (enforceSignature) {
        const expected = crypto
          .createHmac("sha256", RAZORPAY_KEY_SECRET)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest("hex");

        if (!safeEqual(expected, razorpay_signature))
          return res.status(400).json({ error: "Invalid signature" });
      }

      /** PRODUCTION-GRADE: Validate payment on Razorpay server */
      const payment = await validatePaymentFromRazorpay(
        razorpay_payment_id
      );

      logger.info("validatePayment:", payment);

      if (payment.status !== "captured")
        return res.status(400).json({ error: "Payment not captured" });

      if (payment.order_id !== razorpay_order_id)
        return res.status(400).json({ error: "Order mismatch" });

      /** Idempotent transaction */
      const result = await confirmPayment({
        orderId,
        paymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        signature: razorpay_signature,
      });

      /** Apply side-effects (ONLY ON FIRST SUCCESS) */
      if (result.shouldProcess) {
        const data = result.data;

        if (!data.inventoryDeducted) {
          await deductInventory(orderId, data.items || []);
          await db.doc(`orders/${orderId}`).update({
            inventoryDeducted: true,
          });
        }

        if (!data.emailSent) {
          await sendOrderEmail(
            "payment_success",
            toEmailPayload(orderId, data, razorpay_payment_id)
          );
          await db.doc(`orders/${orderId}`).update({
            emailSent: true,
          });
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      if (err.message === "NOT_FOUND")
        return res.status(404).json({ error: "Order not found" });

      logger.error("verify error", err);
      res.status(500).json({ error: "Verification failed" });
    }
  }
);

/* 3. FAIL Payment */
paymentsRouter.post(
  "/fail",
  optionalAuth,
  validate(validateFailPayment),
  async (req, res) => {
    try {
      const { orderId } = req.body as FailPaymentBody;

      await db.doc(`orders/${orderId}`).update({
        paymentStatus: "FAILED",
        orderStatus: "PAYMENT_FAILED",
        updatedAt: FieldValue.serverTimestamp(),
      });

      res.json({ success: true });
    } catch (err) {
      logger.error("fail error", err);
      res.status(500).json({ error: "Failed" });
    }
  }
);

/* 4. WEBHOOK */
export async function razorpayWebhookHandler(
  req: Request,
  res: Response
) {
  try {
    const signature = req.headers[
      "x-razorpay-signature"
    ] as string;

    const raw = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body);

    const expected = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(raw)
      .digest("hex");

    if (!safeEqual(expected, signature)) {
      return res.status(400).json({
        error: "Invalid webhook signature",
      });
    }

    const event = JSON.parse(raw.toString());
    const eventId = event.id;
    const eventRef = db.doc(`webhookEvents/${eventId}`);

    // Idempotent webhook
    const eventSnap = await eventRef.get();
    if (eventSnap.exists)
      return res.json({ received: true });

    await eventRef.set({
      receivedAt: FieldValue.serverTimestamp(),
      eventType: event.event,
    });

    if (event.event === "payment.captured") {
      const entity = event.payload.payment.entity;
      const orderId = entity.notes?.orderId;

      const result = await confirmPayment({
        orderId,
        paymentId: entity.id,
        razorpayOrderId: entity.order_id,
      });

      if (result.shouldProcess) {
        const data = result.data;

        if (!data.inventoryDeducted) {
          await deductInventory(orderId, data.items || []);
          await db.doc(`orders/${orderId}`).update({
            inventoryDeducted: true,
          });
        }

        if (!data.emailSent) {
          await sendOrderEmail(
            "payment_success",
            toEmailPayload(orderId, data, entity.id)
          );
          await db.doc(`orders/${orderId}`).update({
            emailSent: true,
          });
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("webhook error", err);
    res.status(500).json({ error: "Webhook failed" });
  }
}