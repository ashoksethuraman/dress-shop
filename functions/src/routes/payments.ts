import {Router, type Request, type Response} from "express";
import {FieldValue} from "firebase-admin/firestore";
import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import {db} from "../config/firebase";
import {optionalAuth, validate} from "../middleware";
import {sendOrderEmail, type OrderEmailPayload} from "../services/emailService";
import {deductInventory} from "../services/inventoryService";
import {
  type VerifyPaymentBody, type FailPaymentBody,
  type CreateRazorpayOrderBody, type RecordPaymentBody,
} from "../types";
import {
  validateVerifyPayment, validateFailPayment,
  validateCreateRazorpayOrder, validateRecordPayment,
} from "../validators";

export const paymentsRouter = Router();

const enforceRazorpaySignature = (process.env.ENFORCE_RAZORPAY_SIGNATURE ?? "true").toLowerCase() === "true";
const allowMockPayments = (
  process.env.ALLOW_MOCK_PAYMENTS ??
  (process.env.NODE_ENV === "production" ? "false" : "true")
).toLowerCase() === "true";

function toOrderEmailPayload(
  orderId: string,
  orderData: Record<string, unknown>,
  paymentId?: string | null
): OrderEmailPayload {
  return {
    orderId,
    isGuest: (orderData.isGuest as boolean | undefined) ?? false,
    contactEmail: (orderData.contactEmail as string | undefined) ?? null,
    userEmail: (orderData.userEmail as string | undefined) ?? null,
    totalAmount: (orderData.totalAmount as number | undefined) ?? 0,
    paymentId: paymentId ?? (orderData.paymentId as string | undefined) ?? null,
    paymentStatus: (orderData.paymentStatus as string | undefined) ?? null,
    orderStatus: (orderData.orderStatus as string | undefined) ?? null,
    items: (orderData.items as Array<Record<string, unknown>> | undefined)?.map((it) => ({
      title: (it.title as string | undefined) ?? "Item",
      qty: (it.qty as number | undefined) ?? 0,
      unitPrice: (it.unitPrice as number | undefined) ?? 0,
      total: (it.total as number | undefined) ?? 0,
      size: (it.size as string | null | undefined) ?? null,
    })) ?? [],
    billingAddress: (orderData.billingAddress as Record<string, unknown> | undefined),
    shippingAddress: (orderData.shippingAddress as Record<string, unknown> | undefined),
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

paymentsRouter.post("/razorpay-order", validate(validateCreateRazorpayOrder), async (req: Request, res: Response) => {
  const {orderId} = req.body as CreateRazorpayOrderBody;
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keyId || !keySecret) {
    res.status(503).json({error: "Razorpay is not configured on the server."});
    return;
  }
  try {
    const orderSnap = await db.doc(`orders/${orderId}`).get();
    if (!orderSnap.exists) { res.status(404).json({error: "Order not found."}); return; }
    const serverAmount = orderSnap.data()?.totalAmount as number | undefined;
    if (typeof serverAmount !== "number" || serverAmount <= 0) {
      res.status(422).json({error: "Order has an invalid total amount."}); return;
    }
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {"Content-Type": "application/json", "Authorization": `Basic ${credentials}`},
      body: JSON.stringify({amount: Math.round(serverAmount * 100), currency: "INR", receipt: orderId, notes: {orderId}}),
    });
    if (!rzpRes.ok) {
      const errBody = await rzpRes.text();
      logger.error("[POST /payments/razorpay-order] Razorpay error", {errBody});
      res.status(rzpRes.status).json({error: "Razorpay order creation failed.", detail: errBody});
      return;
    }
    const rzpOrder = await rzpRes.json() as Record<string, unknown>;
    logger.info(`[POST /payments/razorpay-order] Created Razorpay order ${rzpOrder.id} for ${orderId}`);
    res.json({razorpayOrderId: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency});
  } catch (err) {
    logger.error("[POST /payments/razorpay-order] error", err);
    res.status(500).json({error: "Failed to create Razorpay order."});
  }
});

paymentsRouter.post("/verify", optionalAuth, validate(validateVerifyPayment), async (req: Request, res: Response) => {
  const {razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId} = req.body as VerifyPaymentBody;
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";

  if (enforceRazorpaySignature && !keySecret) {
    res.status(503).json({error: "RAZORPAY_KEY_SECRET is required for payment verification."}); return;
  }
  if (enforceRazorpaySignature && !razorpay_order_id) {
    res.status(400).json({error: "razorpay_order_id is required for signature verification."}); return;
  }

  if (razorpay_order_id && keySecret) {
    const expected = crypto.createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))) {
      logger.warn("[POST /payments/verify] Signature mismatch", {orderId, uid: req.user?.uid ?? "guest"});
      res.status(400).json({error: "Payment verification failed: invalid signature."}); return;
    }
  } else {
    logger.warn("[POST /payments/verify] Signature check skipped");
  }

  try {
    const orderSnap = await db.doc(`orders/${orderId}`).get();
    if (!orderSnap.exists) { res.status(404).json({error: "Order not found."}); return; }
    const orderData = orderSnap.data()!;
    if (req.user && orderData.userId !== req.user.uid && req.user.role !== "admin") {
      res.status(403).json({error: "Access denied."}); return;
    }
    if (orderData.paymentStatus === "SUCCESS") {
      res.json({success: true, paymentId: orderData.paymentId ?? razorpay_payment_id}); return;
    }

    const batch = db.batch();
    batch.update(db.doc(`orders/${orderId}`), {
      orderStatus: "PLACED", paymentStatus: "SUCCESS", paymentId: razorpay_payment_id,
      updatedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion({status: "PLACED", note: "Payment verified", timestamp: new Date().toISOString()}),
    });
    batch.set(db.doc(`payments/${razorpay_payment_id}`), {
      orderId, provider: "razorpay", providerOrderId: razorpay_order_id ?? null,
      providerPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature ?? null,
      amount: orderData.totalAmount ?? 0, currency: "INR", status: "SUCCESS", method: null, metadata: {},
      customerName: orderData.shippingAddress?.name ?? orderData.billingAddress?.name ?? null,
      customerEmail: orderData.contactEmail ?? orderData.userEmail ?? null,
      userId: req.user?.uid ?? orderData.userId ?? null, isTest: false,
      paidAt: FieldValue.serverTimestamp(), refundedAt: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, {merge: false});
    await batch.commit();

    deductInventory(orderId, orderData.items ?? []).catch(() => {/* already logged */});
    sendOrderEmail("payment_success", {
      ...toOrderEmailPayload(orderId, orderData, razorpay_payment_id),
      paymentStatus: "SUCCESS", orderStatus: "PLACED",
    }).catch((mailErr) => logger.error("[mail] payment_success failed", {orderId, error: mailErr}));

    logger.info(`[POST /payments/verify] Confirmed: order ${orderId}, payment ${razorpay_payment_id}`);
    res.json({success: true, paymentId: razorpay_payment_id});
  } catch (err) {
    logger.error("[POST /payments/verify] error", err);
    res.status(500).json({error: "Failed to update order after payment."});
  }
});

paymentsRouter.post("/fail", optionalAuth, validate(validateFailPayment), async (req: Request, res: Response) => {
  const {orderId, reason = "payment_dismissed"} = req.body as FailPaymentBody;
  try {
    const orderSnap = await db.doc(`orders/${orderId}`).get();
    if (!orderSnap.exists) { res.status(404).json({error: "Order not found."}); return; }
    const orderData = orderSnap.data()!;
    if (req.user && orderData.userId !== req.user.uid && req.user.role !== "admin") {
      res.status(403).json({error: "Access denied."}); return;
    }
    if (orderData.orderStatus === "CANCELLED" || orderData.paymentStatus === "FAILED") {
      res.json({success: true}); return;
    }
    if (orderData.paymentStatus === "SUCCESS") {
      res.status(409).json({error: "Cannot cancel a confirmed (paid) order via this endpoint."}); return;
    }

    const newOrderStatus = reason === "payment_failed" ? "PAYMENT_FAILED" : "CANCELLED";
    const newPaymentStatus = reason === "payment_failed" ? "FAILED" : "CANCELLED";
    await db.doc(`orders/${orderId}`).update({
      orderStatus: newOrderStatus, paymentStatus: newPaymentStatus,
      updatedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion({status: newOrderStatus, note: reason, timestamp: new Date().toISOString()}),
    });
    sendOrderEmail(
      reason === "payment_failed" ? "payment_failed" : "payment_cancelled",
      {...toOrderEmailPayload(orderId, orderData), paymentStatus: newPaymentStatus, orderStatus: newOrderStatus}
    ).catch((mailErr) => logger.error("[mail] payment_fail/cancel failed", {orderId, error: mailErr}));

    logger.info(`[POST /payments/fail] Order ${orderId} \u2192 ${newOrderStatus} (reason: ${reason})`);
    res.json({success: true});
  } catch (err) {
    logger.error("[POST /payments/fail] error", err);
    res.status(500).json({error: "Failed to cancel order."});
  }
});

paymentsRouter.post("/record", optionalAuth, validate(validateRecordPayment), async (req: Request, res: Response) => {
  if (!allowMockPayments) {
    res.status(403).json({error: "Mock payment recording is disabled in this environment."}); return;
  }
  const body = req.body as RecordPaymentBody;
  try {
    const orderSnap = await db.doc(`orders/${body.orderId}`).get();
    if (!orderSnap.exists) { res.status(404).json({error: "Order not found."}); return; }
    const orderData = orderSnap.data()!;
    if (req.user && orderData.userId !== req.user.uid && req.user.role !== "admin") {
      res.status(403).json({error: "Access denied."}); return;
    }
    const serverAmount = orderData.totalAmount as number | undefined;
    if (typeof serverAmount !== "number" || serverAmount <= 0) {
      res.status(422).json({error: "Order has an invalid total amount."}); return;
    }
    const paymentRef = db.doc(`payments/${body.paymentId}`);
    if ((await paymentRef.get()).exists) {
      res.json({success: true, paymentId: body.paymentId}); return;
    }

    const batch = db.batch();
    batch.set(paymentRef, {
      orderId: body.orderId, provider: body.provider ?? "mock",
      providerOrderId: body.razorpayOrderId ?? null, providerPaymentId: body.paymentId,
      razorpaySignature: body.razorpaySignature ?? null,
      amount: serverAmount, currency: body.currency ?? "INR",
      status: "SUCCESS", method: body.method ?? null, metadata: {},
      customerName: body.customerName ?? null, customerEmail: body.customerEmail ?? null,
      userId: req.user?.uid ?? orderData.userId ?? null, isTest: body.isTest ?? true,
      paidAt: FieldValue.serverTimestamp(), refundedAt: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(db.doc(`orders/${body.orderId}`), {
      orderStatus: "PLACED", paymentStatus: "SUCCESS", paymentId: body.paymentId,
      updatedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion({status: "PLACED", note: "Payment confirmed", timestamp: new Date().toISOString()}),
    });
    await batch.commit();

    deductInventory(body.orderId, orderData.items ?? []).catch(() => {/* already logged */});
    sendOrderEmail("payment_success", {
      ...toOrderEmailPayload(body.orderId, orderData, body.paymentId),
      paymentStatus: "SUCCESS", orderStatus: "PLACED",
    }).catch((mailErr) => logger.error("[mail] payment_success(record) failed", {orderId: body.orderId, error: mailErr}));

    logger.info(`[POST /payments/record] Recorded ${body.paymentId} for order ${body.orderId}`);
    res.status(201).json({success: true, paymentId: body.paymentId});
  } catch (err) {
    logger.error("[POST /payments/record] error", err);
    res.status(500).json({error: "Failed to record payment."});
  }
});

