import { onRequest } from "firebase-functions/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import { setCors, optionalToken } from "./helpers";
import {
  type VerifyPaymentBody,
  type FailPaymentBody,
  type CreateRazorpayOrderBody,
  type RecordPaymentBody,
  validateVerifyPayment,
  validateFailPayment,
  validateCreateRazorpayOrder,
  validateRecordPayment,
} from "./schemas";

// ── POST /apiVerifyPayment ──────────────────────────────────────────────────
// Authenticated. Verifies the Razorpay HMAC-SHA256 signature and marks the
// order as confirmed in Firestore.
//
// Set the Razorpay key secret before deploying:
//   firebase functions:secrets:set RAZORPAY_KEY_SECRET
//
// Body:
//   {
//     razorpay_order_id:   string   (Razorpay order ID from your backend)
//     razorpay_payment_id: string   (returned by Razorpay checkout)
//     razorpay_signature:  string   (returned by Razorpay checkout)
//     orderId:             string   (your internal Dress Shop order ID)
//   }
export const apiVerifyPayment = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiVerifyPayment] →", { method: req.method, orderId: req.body?.orderId });
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  // Token is optional — guests can verify payments too; HMAC is the real security
  const decoded = await optionalToken(req);

  const validation = validateVerifyPayment(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error, field: validation.field });
    return;
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } =
    req.body as VerifyPaymentBody;

  // Verify HMAC-SHA256 signature when key secret is configured
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (razorpay_order_id && keySecret) {
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))) {
      logger.warn("Razorpay signature mismatch", { orderId, uid: decoded?.uid ?? "guest" });
      res.status(400).json({ error: "Payment verification failed: invalid signature." });
      return;
    }
  } else {
    logger.warn("Signature verification skipped (RAZORPAY_KEY_SECRET not set or no order_id)");
  }

  try {
    // Confirm the order belongs to this user before marking it paid
    const orderSnap = await admin.firestore().doc(`orders/${orderId}`).get();
    if (!orderSnap.exists) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    const orderData = orderSnap.data()!;
    // Ownership check only applies to logged-in users; guests rely on HMAC for security
    if (decoded && orderData.userId !== decoded.uid && !decoded["isAdmin"]) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    // Idempotency: if already confirmed, return success without re-writing
    if (orderData.paymentStatus === "SUCCESS") {
      logger.info(`Payment already confirmed for order ${orderId}, skipping duplicate verify`);
      res.json({ success: true, paymentId: orderData.paymentId ?? razorpay_payment_id });
      return;
    }

    const batch = admin.firestore().batch();

    // 1. Update the order status fields
    batch.update(admin.firestore().doc(`orders/${orderId}`), {
      orderStatus:   "PLACED",
      paymentStatus: "SUCCESS",
      paymentId:     razorpay_payment_id,
      updatedAt:     FieldValue.serverTimestamp(),
      timeline:      FieldValue.arrayUnion({
        status: "PLACED", note: "Payment verified", timestamp: new Date().toISOString(),
      }),
    });

    // 2. Write the payment ledger record (no card data — PCI-DSS safe)
    const paymentDoc = admin.firestore().doc(`payments/${razorpay_payment_id}`);
    batch.set(paymentDoc, {
      orderId,
      provider:          "razorpay",
      providerOrderId:   razorpay_order_id   ?? null,
      providerPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature  ?? null,
      amount:   orderData.totalAmount ?? 0,
      currency: "INR",
      status:   "SUCCESS",
      method:   null,   // available from Razorpay payment.fetch() if needed
      metadata: {},
      customerName: orderData.shippingAddress?.name
        ?? orderData.billingAddress?.name
        ?? null,
      customerEmail: orderData.contactEmail ?? orderData.userEmail ?? null,
      userId:   decoded?.uid ?? orderData.userId ?? null,
      isTest:   false,
      paidAt:   FieldValue.serverTimestamp(),
      refundedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: false });

    await batch.commit();

    logger.info(`Payment confirmed: order ${orderId}, payment ${razorpay_payment_id}, user ${decoded?.uid ?? "guest"}`);
    res.json({ success: true, paymentId: razorpay_payment_id });
  } catch (err) {
    logger.error("verifyPayment error", err);
    res.status(500).json({ error: "Failed to update order after payment." });
  }
});

// ── POST /apiFailPayment ────────────────────────────────────────────────────
// Guest-friendly. Marks an order as cancelled when Razorpay is dismissed or fails.
// Body: { orderId: string }
export const apiFailPayment = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiFailPayment] →", { method: req.method, orderId: req.body?.orderId, reason: req.body?.reason });
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await optionalToken(req);

  const validation = validateFailPayment(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error, field: validation.field });
    return;
  }
  const { orderId, reason = "payment_dismissed" } = req.body as FailPaymentBody;

  try {
    const orderSnap = await admin.firestore().doc(`orders/${orderId}`).get();
    if (!orderSnap.exists) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    const orderData = orderSnap.data()!;
    // Ownership check — logged-in users can only cancel their own orders
    if (decoded && orderData.userId !== decoded.uid && !decoded["isAdmin"]) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    // Idempotency: already in a terminal failed/cancelled state — return success
    if (orderData.orderStatus === "CANCELLED" || orderData.paymentStatus === "FAILED") {
      res.json({ success: true });
      return;
    }
    // Never overwrite a confirmed/paid order
    if (orderData.paymentStatus === "SUCCESS") {
      res.status(409).json({ error: "Cannot cancel a confirmed (paid) order via this endpoint." });
      return;
    }

    const newOrderStatus   = reason === "payment_failed" ? "PAYMENT_FAILED" : "CANCELLED";
    const newPaymentStatus = reason === "payment_failed" ? "FAILED"         : "CANCELLED";

    await admin.firestore().doc(`orders/${orderId}`).update({
      orderStatus:   newOrderStatus,
      paymentStatus: newPaymentStatus,
      updatedAt:     FieldValue.serverTimestamp(),
      timeline:      FieldValue.arrayUnion({
        status: newOrderStatus, note: reason, timestamp: new Date().toISOString(),
      }),
    });

    logger.info(`Order ${orderId} → ${newOrderStatus} (reason: ${reason}) by ${decoded?.uid ?? "guest"}`);
    res.json({ success: true });
  } catch (err) {
    logger.error("failPayment error", err);
    res.status(500).json({ error: "Failed to cancel order." });
  }
});

// ── POST /apiCreateRazorpayOrder
// This gives you an `order_id` that Razorpay checkout needs for signature
// verification to work.
//
// Requires env vars:
//   RAZORPAY_KEY_ID      — your test/live Key ID
//   RAZORPAY_KEY_SECRET  — your test/live Key Secret
//
// Body: { amount: number (in INR), orderId: string }
export const apiCreateRazorpayOrder = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiCreateRazorpayOrder] →", { method: req.method, orderId: req.body?.orderId, amount: req.body?.amount });
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  // No auth required — guests need this to initiate payment
  const validation = validateCreateRazorpayOrder(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error, field: validation.field });
    return;
  }
  const { amount, orderId } = req.body as CreateRazorpayOrderBody;

  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keyId || !keySecret) {
    res.status(503).json({ error: "Razorpay is not configured on the server." });
    return;
  }

  try {
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency: "INR",
        receipt: orderId,
        notes: { orderId },  // no userId — guest-friendly
      }),
    });

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text();
      logger.error("Razorpay order creation failed", errBody);
      res.status(rzpRes.status).json({ error: "Razorpay order creation failed.", detail: errBody });
      return;
    }

    const rzpOrder = await rzpRes.json() as Record<string, unknown>;
    logger.info(`Razorpay order created: ${rzpOrder.id} for internal order ${orderId}`);
    res.json({ razorpayOrderId: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency });
  } catch (err) {
    logger.error("createRazorpayOrder error", err);
    res.status(500).json({ error: "Failed to create Razorpay order." });
  }
});

// ── POST /apiRecordPayment ──────────────────────────────────────────────────
// Used by mock/test mode to write a payment ledger record without going
// through Razorpay.  In production, apiVerifyPayment writes this automatically.
//
// Body:
//   {
//     paymentId:        string   (mock or real payment ID)
//     orderId:          string   (internal order ID)
//     razorpayOrderId:  string | null
//     razorpaySignature:string | null
//     transactionRef:   string | null
//     utr:              string | null
//     amount:           number
//     currency:         string   defaults "INR"
//     method:           string | null  e.g. "mock", "card", "upi"
//     cardLast4:        string | null  — last 4 digits ONLY, no full PAN
//     cardNetwork:      string | null
//     customerName:     string | null
//     customerEmail:    string | null
//     isTest:           boolean  defaults true when called from mock mode
//   }
export const apiRecordPayment = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiRecordPayment] →", { method: req.method, orderId: req.body?.orderId });
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await optionalToken(req);

  const validation = validateRecordPayment(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error, field: validation.field });
    return;
  }
  const body = req.body as RecordPaymentBody;

  try {
    // Ownership guard: verify the order belongs to this caller before writing
    const orderSnap = await admin.firestore().doc(`orders/${body.orderId}`).get();
    if (!orderSnap.exists) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    const orderData = orderSnap.data()!;
    if (decoded && orderData.userId !== decoded.uid && !decoded["isAdmin"]) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    // Ownership guard also covers already-failed/cancelled orders
    // Idempotency: skip if payment doc already exists
    const paymentRef = admin.firestore().doc(`payments/${body.paymentId}`);
    const existing = await paymentRef.get();
    if (existing.exists) {
      res.json({ success: true, paymentId: body.paymentId });
      return;
    }

    const batch = admin.firestore().batch();

    // Write the payment ledger record
    batch.set(paymentRef, {
      orderId:           body.orderId,
      provider:          body.provider          ?? "mock",
      providerOrderId:   body.razorpayOrderId   ?? null,
      providerPaymentId: body.paymentId,
      razorpaySignature: body.razorpaySignature  ?? null,
      amount:            body.amount,
      currency:          body.currency           ?? "INR",
      status:            "SUCCESS",
      method:            body.method             ?? null,
      metadata:          {},
      customerName:      body.customerName       ?? null,
      customerEmail:     body.customerEmail      ?? null,
      userId: decoded?.uid ?? orderData.userId ?? null,
      isTest: body.isTest ?? true,
      paidAt:     FieldValue.serverTimestamp(),
      refundedAt: null,
      createdAt:  FieldValue.serverTimestamp(),
      updatedAt:  FieldValue.serverTimestamp(),
    });

    // Also stamp the order with paymentId / confirmed status
    batch.update(admin.firestore().doc(`orders/${body.orderId}`), {
      orderStatus:   "PLACED",
      paymentStatus: "SUCCESS",
      paymentId:     body.paymentId,
      updatedAt: FieldValue.serverTimestamp(),
      timeline:  FieldValue.arrayUnion({
        status: "PLACED", note: "Payment confirmed", timestamp: new Date().toISOString(),
      }),
    });

    await batch.commit();

    logger.info(`[apiRecordPayment] Recorded payment ${body.paymentId} for order ${body.orderId} (isTest: ${body.isTest ?? true})`);
    res.status(201).json({ success: true, paymentId: body.paymentId });
  } catch (err) {
    logger.error("recordPayment error", err);
    res.status(500).json({ error: "Failed to record payment." });
  }
});
