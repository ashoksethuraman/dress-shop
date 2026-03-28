import {Router, type Request, type Response} from "express";
import {FieldValue} from "firebase-admin/firestore";
import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import {db} from "../firebase";
import {optionalAuth, validate} from "../middleware";
import {
  type VerifyPaymentBody,
  type FailPaymentBody,
  type CreateRazorpayOrderBody,
  type RecordPaymentBody,
  validateVerifyPayment,
  validateFailPayment,
  validateCreateRazorpayOrder,
  validateRecordPayment,
} from "../schemas";

export const paymentsRouter = Router();

paymentsRouter.post(
  "/razorpay-order",
  validate(validateCreateRazorpayOrder),
  async (req: Request, res: Response) => {
    const {amount, orderId} = req.body as CreateRazorpayOrderBody;

    const keyId = process.env.RAZORPAY_KEY_ID ?? "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
    if (!keyId || !keySecret) {
      res.status(503).json({error: "Razorpay is not configured on the server."});
      return;
    }

    try {
      const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${credentials}`,
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency: "INR",
          receipt: orderId,
          notes: {orderId},
        }),
      });

      if (!rzpRes.ok) {
        const errBody = await rzpRes.text();
        logger.error("[POST /payments/razorpay-order] Razorpay error", {errBody});
        res.status(rzpRes.status).json({error: "Razorpay order creation failed.", detail: errBody});
        return;
      }

      const rzpOrder = await rzpRes.json() as Record<string, unknown>;
      logger.info(`[POST /payments/razorpay-order] Created Razorpay order ${rzpOrder.id} for internal order ${orderId}`);
      res.json({razorpayOrderId: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency});
    } catch (err) {
      logger.error("[POST /payments/razorpay-order] error", err);
      res.status(500).json({error: "Failed to create Razorpay order."});
    }
  }
);

paymentsRouter.post(
  "/verify",
  optionalAuth,
  validate(validateVerifyPayment),
  async (req: Request, res: Response) => {
    const {razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId} =
      req.body as VerifyPaymentBody;

    const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
    if (razorpay_order_id && keySecret) {
      const expected = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))) {
        logger.warn("[POST /payments/verify] Signature mismatch", {orderId, uid: req.user?.uid ?? "guest"});
        res.status(400).json({error: "Payment verification failed: invalid signature."});
        return;
      }
    } else {
      logger.warn("[POST /payments/verify] Signature check skipped — RAZORPAY_KEY_SECRET not set or no order_id");
    }

    try {
      const orderSnap = await db.doc(`orders/${orderId}`).get();
      if (!orderSnap.exists) {
        res.status(404).json({error: "Order not found."}); return;
      }

      const orderData = orderSnap.data()!;

      if (req.user && orderData.userId !== req.user.uid && !req.user["isAdmin"]) {
        res.status(403).json({error: "Access denied."});
        return;
      }

      if (orderData.paymentStatus === "SUCCESS") {
        logger.info(`[POST /payments/verify] Already confirmed for order ${orderId} — skipping`);
        res.json({success: true, paymentId: orderData.paymentId ?? razorpay_payment_id});
        return;
      }

      const batch = db.batch();

      batch.update(db.doc(`orders/${orderId}`), {
        orderStatus: "PLACED",
        paymentStatus: "SUCCESS",
        paymentId: razorpay_payment_id,
        updatedAt: FieldValue.serverTimestamp(),
        timeline: FieldValue.arrayUnion({
          status: "PLACED", note: "Payment verified", timestamp: new Date().toISOString(),
        }),
      });

      batch.set(db.doc(`payments/${razorpay_payment_id}`), {
        orderId,
        provider: "razorpay",
        providerOrderId: razorpay_order_id ?? null,
        providerPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature ?? null,
        amount: orderData.totalAmount ?? 0,
        currency: "INR",
        status: "SUCCESS",
        method: null,
        metadata: {},
        customerName: orderData.shippingAddress?.name ?? orderData.billingAddress?.name ?? null,
        customerEmail: orderData.contactEmail ?? orderData.userEmail ?? null,
        userId: req.user?.uid ?? orderData.userId ?? null,
        isTest: false,
        paidAt: FieldValue.serverTimestamp(),
        refundedAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: false});

      await batch.commit();

      logger.info(`[POST /payments/verify] Confirmed: order ${orderId}, payment ${razorpay_payment_id}, user ${req.user?.uid ?? "guest"}`);
      res.json({success: true, paymentId: razorpay_payment_id});
    } catch (err) {
      logger.error("[POST /payments/verify] error", err);
      res.status(500).json({error: "Failed to update order after payment."});
    }
  }
);

paymentsRouter.post(
  "/fail",
  optionalAuth,
  validate(validateFailPayment),
  async (req: Request, res: Response) => {
    const {orderId, reason = "payment_dismissed"} = req.body as FailPaymentBody;

    try {
      const orderSnap = await db.doc(`orders/${orderId}`).get();
      if (!orderSnap.exists) {
        res.status(404).json({error: "Order not found."}); return;
      }

      const orderData = orderSnap.data()!;

      if (req.user && orderData.userId !== req.user.uid && !req.user["isAdmin"]) {
        res.status(403).json({error: "Access denied."});
        return;
      }

      if (orderData.orderStatus === "CANCELLED" || orderData.paymentStatus === "FAILED") {
        res.json({success: true});
        return;
      }

      if (orderData.paymentStatus === "SUCCESS") {
        res.status(409).json({error: "Cannot cancel a confirmed (paid) order via this endpoint."});
        return;
      }

      const newOrderStatus = reason === "payment_failed" ? "PAYMENT_FAILED" : "CANCELLED";
      const newPaymentStatus = reason === "payment_failed" ? "FAILED" : "CANCELLED";

      await db.doc(`orders/${orderId}`).update({
        orderStatus: newOrderStatus,
        paymentStatus: newPaymentStatus,
        updatedAt: FieldValue.serverTimestamp(),
        timeline: FieldValue.arrayUnion({
          status: newOrderStatus, note: reason, timestamp: new Date().toISOString(),
        }),
      });

      logger.info(`[POST /payments/fail] Order ${orderId} → ${newOrderStatus} (reason: ${reason}) by ${req.user?.uid ?? "guest"}`);
      res.json({success: true});
    } catch (err) {
      logger.error("[POST /payments/fail] error", err);
      res.status(500).json({error: "Failed to cancel order."});
    }
  }
);

paymentsRouter.post(
  "/record",
  optionalAuth,
  validate(validateRecordPayment),
  async (req: Request, res: Response) => {
    const body = req.body as RecordPaymentBody;

    try {
      const orderSnap = await db.doc(`orders/${body.orderId}`).get();
      if (!orderSnap.exists) {
        res.status(404).json({error: "Order not found."}); return;
      }

      const orderData = orderSnap.data()!;

      if (req.user && orderData.userId !== req.user.uid && !req.user["isAdmin"]) {
        res.status(403).json({error: "Access denied."});
        return;
      }

      const paymentRef = db.doc(`payments/${body.paymentId}`);
      if ((await paymentRef.get()).exists) {
        res.json({success: true, paymentId: body.paymentId});
        return;
      }

      const batch = db.batch();

      batch.set(paymentRef, {
        orderId: body.orderId,
        provider: body.provider ?? "mock",
        providerOrderId: body.razorpayOrderId ?? null,
        providerPaymentId: body.paymentId,
        razorpaySignature: body.razorpaySignature ?? null,
        amount: body.amount,
        currency: body.currency ?? "INR",
        status: "SUCCESS",
        method: body.method ?? null,
        metadata: {},
        customerName: body.customerName ?? null,
        customerEmail: body.customerEmail ?? null,
        userId: req.user?.uid ?? orderData.userId ?? null,
        isTest: body.isTest ?? true,
        paidAt: FieldValue.serverTimestamp(),
        refundedAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      batch.update(db.doc(`orders/${body.orderId}`), {
        orderStatus: "PLACED",
        paymentStatus: "SUCCESS",
        paymentId: body.paymentId,
        updatedAt: FieldValue.serverTimestamp(),
        timeline: FieldValue.arrayUnion({
          status: "PLACED", note: "Payment confirmed", timestamp: new Date().toISOString(),
        }),
      });

      await batch.commit();

      logger.info(`[POST /payments/record] Recorded ${body.paymentId} for order ${body.orderId} (isTest: ${body.isTest ?? true})`);
      res.status(201).json({success: true, paymentId: body.paymentId});
    } catch (err) {
      logger.error("[POST /payments/record] error", err);
      res.status(500).json({error: "Failed to record payment."});
    }
  }
);
