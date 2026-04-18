import {Router, type Request, type Response} from "express";
import {FieldValue} from "firebase-admin/firestore";
import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import {db} from "../config/firebase";
import {optionalAuth, validate, requireAdmin} from "../middleware";
import {sendOrderEmail, type OrderEmailPayload} from "../services/emailService";
import {deductInventory} from "../services/inventoryService";
import {
  type VerifyPaymentBody, type FailPaymentBody,
  type CreateRazorpayOrderBody, type RecordPaymentBody,
  type RefundOrderBody,
} from "../types";
import {
  validateVerifyPayment, validateFailPayment,
  validateCreateRazorpayOrder, validateRecordPayment,
  validateRefundOrder,
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

// ── Shared atomic payment confirmation (Firestore transaction) ───────────────
// Used by both /verify (client callback) and the Razorpay webhook so that
// exactly one of the two paths triggers inventory deduction and confirmation email
// even when they arrive concurrently (browser close / double-click scenarios).

type ConfirmTxResult =
  | {status: "ok"; orderData: Record<string, unknown>}
  | {status: "already_paid"; existingPaymentId: string | null}
  | {status: "not_found"}
  | {status: "forbidden"};

async function confirmPaymentTransaction(opts: {
  orderId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string | null;
  razorpaySignature: string | null;
  callerUid: string | null;
  callerRole: string | undefined;
}): Promise<ConfirmTxResult> {
  const {orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature, callerUid, callerRole} = opts;
  let result: ConfirmTxResult = {status: "not_found"};

  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(db.doc(`orders/${orderId}`));
    if (!orderSnap.exists) { result = {status: "not_found"}; return; }
    const orderData = orderSnap.data()!;

    if (callerUid && orderData.userId !== callerUid && callerRole !== "admin") {
      result = {status: "forbidden"}; return;
    }
    if (orderData.paymentStatus === "SUCCESS") {
      result = {status: "already_paid", existingPaymentId: (orderData.paymentId as string | null) ?? null};
      return;
    }

    tx.update(db.doc(`orders/${orderId}`), {
      orderStatus: "PLACED", paymentStatus: "SUCCESS", paymentId: razorpayPaymentId,
      updatedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion({status: "PLACED", note: "Payment verified", timestamp: new Date().toISOString()}),
    });
    tx.set(db.doc(`payments/${razorpayPaymentId}`), {
      orderId, provider: "razorpay",
      providerOrderId: razorpayOrderId ?? null,
      providerPaymentId: razorpayPaymentId,
      razorpaySignature: razorpaySignature ?? null,
      amount: (orderData.totalAmount as number) ?? 0, currency: "INR",
      status: "SUCCESS", method: null, metadata: {},
      customerName: (orderData.shippingAddress as any)?.name ?? (orderData.billingAddress as any)?.name ?? null,
      customerEmail: (orderData.contactEmail as string | null) ?? (orderData.userEmail as string | null) ?? null,
      userId: callerUid ?? (orderData.userId as string | null) ?? null, isTest: false,
      paidAt: FieldValue.serverTimestamp(), refundedAt: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, {merge: false});

    result = {status: "ok", orderData};
  });

  return result;
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
    const orderData = orderSnap.data()!;
    const serverAmount = orderData.totalAmount as number | undefined;
    if (typeof serverAmount !== "number" || serverAmount <= 0) {
      res.status(422).json({error: "Order has an invalid total amount."}); return;
    }

    // ── Idempotency: reuse existing Razorpay order if already created ─────────
    // Prevents duplicate Razorpay orders when the user retries the Pay button
    // without having completed or dismissed the previous checkout session.
    if (orderData.razorpayOrderId) {
      logger.info(`[POST /payments/razorpay-order] Reusing existing Razorpay order ${orderData.razorpayOrderId} for ${orderId}`);
      // Re-fetch amount from stored order (server-authoritative)
      res.json({
        razorpayOrderId: orderData.razorpayOrderId,
        amount: Math.round(serverAmount * 100),
        currency: "INR",
        keyId,
      });
      return;
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {"Content-Type": "application/json", "Authorization": `Basic ${credentials}`},
      body: JSON.stringify({amount: Math.round(serverAmount * 100), currency: "INR", receipt: orderId, notes: {orderId}}),
    });
    if (!rzpRes.ok) {
      const errBody = await rzpRes.text();
      let rzpDescription = "";
      try {
        const rzpErr = JSON.parse(errBody);
        rzpDescription = rzpErr?.error?.description ?? rzpErr?.error?.code ?? "";
      } catch { /* ignore parse errors */ }
      const userMessage = rzpDescription
        ? `Payment setup failed: ${rzpDescription}`
        : "Razorpay order creation failed.";
      logger.error("[POST /payments/razorpay-order] Razorpay error", {errBody});
      res.status(rzpRes.status).json({error: userMessage});
      return;
    }
    const rzpOrder = await rzpRes.json() as Record<string, unknown>;
    // Store razorpayOrderId on order document for webhook cross-referencing
    await db.doc(`orders/${orderId}`).update({
      razorpayOrderId: rzpOrder.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`[POST /payments/razorpay-order] Created Razorpay order ${rzpOrder.id} for ${orderId}`);
    // keyId is safe to send to the client — it is the public identifier, not the secret
    res.json({razorpayOrderId: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency, keyId});
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
    const result = await confirmPaymentTransaction({
      orderId,
      razorpayPaymentId:  razorpay_payment_id,
      razorpayOrderId:    razorpay_order_id ?? null,
      razorpaySignature:  razorpay_signature ?? null,
      callerUid:          req.user?.uid ?? null,
      callerRole:         req.user?.role,
    });

    if (result.status === "not_found") { res.status(404).json({error: "Order not found."}); return; }
    if (result.status === "forbidden") { res.status(403).json({error: "Access denied."}); return; }
    if (result.status === "already_paid") {
      res.json({success: true, paymentId: result.existingPaymentId ?? razorpay_payment_id}); return;
    }

    // result.status === "ok" — transaction committed; side-effects fire exactly once
    deductInventory(orderId, (result.orderData.items as any[]) ?? []).catch(() => {/* already logged */});
    sendOrderEmail("payment_success", {
      ...toOrderEmailPayload(orderId, result.orderData, razorpay_payment_id),
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

// ── Admin-only manual refund ──────────────────────────────────────────────────
// Rules enforced server-side (no client trust):
//   - Caller must be admin (requireAdmin middleware)
//   - paymentStatus must be SUCCESS  →  prevents refund of COD / pending / already-refunded
//   - refundStatus must be NONE      →  prevents duplicate refund initiation
//   - orderStatus must NOT be SHIPPED or DELIVERED  →  admin warning (soft-block)
//
// After Razorpay processes the refund it fires a refund.processed / refund.failed
// webhook which updates the order to REFUNDED / REFUND_FAILED via razorpayWebhookHandler.
paymentsRouter.post("/refund", requireAdmin, validate(validateRefundOrder), async (req: Request, res: Response) => {
  const {orderId, reason} = req.body as RefundOrderBody;
  const keyId     = process.env.RAZORPAY_KEY_ID     ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET  ?? "";
  if (!keyId || !keySecret) {
    res.status(503).json({error: "Razorpay is not configured on the server."}); return;
  }

  try {
    const orderSnap = await db.doc(`orders/${orderId}`).get();
    if (!orderSnap.exists) { res.status(404).json({error: "Order not found."}); return; }
    const orderData = orderSnap.data()!;

    // ── Eligibility checks (server-enforced) ─────────────────────────────────
    if (orderData.paymentStatus !== "SUCCESS") {
      res.status(409).json({
        error: "Refund is only allowed for orders with payment status SUCCESS. COD and unpaid orders cannot be refunded.",
      }); return;
    }
    if ((orderData.refundStatus ?? "NONE") !== "NONE") {
      res.status(409).json({
        error: `A refund is already ${orderData.refundStatus} for this order.`,
      }); return;
    }

    const paymentId = orderData.paymentId as string | undefined;
    if (!paymentId) {
      res.status(422).json({error: "No paymentId found on order. Cannot initiate refund."}); return;
    }
    const amount = orderData.totalAmount as number | undefined;
    if (typeof amount !== "number" || amount <= 0) {
      res.status(422).json({error: "Order has an invalid total amount."}); return;
    }

    // ── Mark INITIATED atomically before calling Razorpay ────────────────────
    // This prevents race conditions if the admin double-clicks.
    const alreadyInitiated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.doc(`orders/${orderId}`));
      const d = snap.data()!;
      if ((d.refundStatus ?? "NONE") !== "NONE") return true;
      tx.update(db.doc(`orders/${orderId}`), {
        refundStatus:  "INITIATED",
        updatedAt:     FieldValue.serverTimestamp(),
        timeline: FieldValue.arrayUnion({
          status: "REFUND_INITIATED",
          note:   reason ?? "Admin initiated refund",
          timestamp: new Date().toISOString(),
        }),
      });
      return false;
    });

    if (alreadyInitiated) {
      res.status(409).json({error: "Refund already initiated for this order."}); return;
    }

    // ── Call Razorpay refund API ──────────────────────────────────────────────
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: "POST",
      headers: {"Content-Type": "application/json", "Authorization": `Basic ${credentials}`},
      body: JSON.stringify({
        amount:  Math.round(amount * 100),
        notes:   {orderId, reason: reason ?? "admin_refund"},
        speed:   "optimum",   // "normal" = 5-7 days, "optimum" = instant if eligible
      }),
    });

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text();
      logger.error("[POST /payments/refund] Razorpay refund error", {orderId, paymentId, errBody});
      // Rollback refundStatus to NONE so admin can retry
      await db.doc(`orders/${orderId}`).update({
        refundStatus:  "FAILED",
        updatedAt:     FieldValue.serverTimestamp(),
        timeline: FieldValue.arrayUnion({
          status: "REFUND_FAILED",
          note:   `Razorpay API error: ${rzpRes.status}`,
          timestamp: new Date().toISOString(),
        }),
      });
      res.status(rzpRes.status).json({error: "Razorpay refund initiation failed.", detail: errBody}); return;
    }

    const rzpRefund = await rzpRes.json() as Record<string, unknown>;
    const refundId = rzpRefund.id as string;
    logger.info(`[POST /payments/refund] Initiated refund ${refundId} for order ${orderId}, payment ${paymentId}`);

    // Store refundId for webhook cross-referencing
    await db.doc(`orders/${orderId}`).update({
      refundId:    refundId,
      refundStatus: "PROCESSING",
      updatedAt:   FieldValue.serverTimestamp(),
    });

    res.json({success: true, refundId, status: rzpRefund.status});
  } catch (err) {
    logger.error("[POST /payments/refund] error", err);
    res.status(500).json({error: "Failed to initiate refund."});
  }
});

// ── Razorpay Webhook Handler ──────────────────────────────────────────────────
// Mounted with express.raw({ type: "application/json" }) in app.ts BEFORE
// express.json(), so the raw body is available for HMAC verification.
//
// Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://<your-api-url>/payments/webhook
//   Events: payment.captured, payment.failed
//   Secret: set RAZORPAY_WEBHOOK_SECRET in functions/.env  (different from API key secret)
//
// Why this is required: if the user's browser closes after Razorpay collects
// payment but before the client POSTs to /verify, this webhook fires and
// confirms the order so it never stays stuck in PENDING.
export async function razorpayWebhookHandler(req: Request, res: Response): Promise<void> {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!webhookSecret) {
    logger.error("[webhook] RAZORPAY_WEBHOOK_SECRET not configured");
    res.status(503).json({error: "Webhook not configured."});
    return;
  }

  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  if (!signature) {
    res.status(400).json({error: "Missing X-Razorpay-Signature header."});
    return;
  }

  // req.body is a Buffer when mounted with express.raw()
  const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body));
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"))
  ) {
    logger.warn("[webhook] Signature mismatch — possible replay/forgery");
    res.status(400).json({error: "Invalid signature."});
    return;
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({error: "Invalid JSON payload."});
    return;
  }

  const eventType = event.event as string | undefined;
  const paymentEntity = (
    (event.payload as Record<string, unknown> | undefined)?.payment as Record<string, unknown> | undefined
  )?.entity as Record<string, unknown> | undefined;

  logger.info("[webhook] Received", {eventType, paymentId: paymentEntity?.id});

  // ── payment.captured ───────────────────────────────────────────────────────
  if (eventType === "payment.captured") {
    if (!paymentEntity) {
      res.status(400).json({error: "Missing payment entity."}); return;
    }
    const razorpayPaymentId = paymentEntity.id as string | undefined;
    const razorpayOrderId   = paymentEntity.order_id as string | undefined;
    // orderId is stored in Razorpay order notes when we call /payments/razorpay-order
    const orderId = (paymentEntity.notes as Record<string, unknown> | undefined)?.orderId as string | undefined;

    if (!razorpayPaymentId || !orderId) {
      logger.warn("[webhook] payment.captured missing payment_id or notes.orderId", {razorpayOrderId});
      res.status(400).json({error: "Missing payment_id or orderId in notes."}); return;
    }

    try {
      const result = await confirmPaymentTransaction({
        orderId,
        razorpayPaymentId,
        razorpayOrderId: razorpayOrderId ?? null,
        razorpaySignature: null,  // checkout signature not available in webhook
        callerUid: null,
        callerRole: undefined,
      });

      if (result.status === "not_found") {
        // Return 200 so Razorpay stops retrying — log for investigation
        logger.warn("[webhook] payment.captured — order not found", {orderId, razorpayPaymentId});
        res.status(200).json({received: true}); return;
      }
      if (result.status === "already_paid") {
        logger.info("[webhook] payment.captured — already confirmed, skipping", {orderId});
        res.status(200).json({received: true}); return;
      }
      if (result.status === "forbidden") {
        // callerUid is null for webhooks so this branch is unreachable; guard for type safety
        logger.warn("[webhook] payment.captured — unexpected forbidden", {orderId});
        res.status(200).json({received: true}); return;
      }

      // result.status === "ok" — fires if client verify didn't beat us here
      deductInventory(orderId, (result.orderData.items as any[]) ?? []).catch(() => {/* already logged */});
      sendOrderEmail("payment_success", {
        ...toOrderEmailPayload(orderId, result.orderData, razorpayPaymentId),
        paymentStatus: "SUCCESS", orderStatus: "PLACED",
      }).catch((mailErr) => logger.error("[mail] webhook payment_success failed", {orderId, error: mailErr}));

      logger.info(`[webhook] payment.captured confirmed: order ${orderId}, payment ${razorpayPaymentId}`);
      res.status(200).json({received: true});
    } catch (err) {
      logger.error("[webhook] payment.captured error", err);
      res.status(500).json({error: "Internal error processing webhook."});
    }
    return;
  }

  // ── payment.failed ─────────────────────────────────────────────────────────
  if (eventType === "payment.failed") {
    const orderId = (paymentEntity?.notes as Record<string, unknown> | undefined)?.orderId as string | undefined;
    if (orderId) {
      logger.info("[webhook] payment.failed", {orderId, paymentId: paymentEntity?.id});
      try {
        const orderSnap = await db.doc(`orders/${orderId}`).get();
        if (orderSnap.exists && orderSnap.data()?.paymentStatus !== "SUCCESS") {
          await db.doc(`orders/${orderId}`).update({
            orderStatus: "PAYMENT_FAILED", paymentStatus: "FAILED",
            updatedAt: FieldValue.serverTimestamp(),
            timeline: FieldValue.arrayUnion({
              status: "PAYMENT_FAILED", note: "payment.failed webhook", timestamp: new Date().toISOString(),
            }),
          });
        }
      } catch (err) {
        logger.error("[webhook] payment.failed update error", err);
      }
    }
    res.status(200).json({received: true});
    return;
  }

  // ── refund.processed ───────────────────────────────────────────────────────
  if (eventType === "refund.processed") {
    const refundEntity = (
      (event.payload as Record<string, unknown> | undefined)?.refund as Record<string, unknown> | undefined
    )?.entity as Record<string, unknown> | undefined;
    const orderId  = (refundEntity?.notes as Record<string, unknown> | undefined)?.orderId as string | undefined;
    const refundId = refundEntity?.id as string | undefined;
    logger.info("[webhook] refund.processed", {orderId, refundId});
    if (orderId) {
      try {
        await db.doc(`orders/${orderId}`).update({
          refundStatus: "COMPLETED",
          paymentStatus: "REFUNDED",
          updatedAt: FieldValue.serverTimestamp(),
          timeline: FieldValue.arrayUnion({
            status: "REFUND_COMPLETED",
            note: `Refund ${refundId ?? ""} processed by Razorpay`,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        logger.error("[webhook] refund.processed update error", err);
      }
    }
    res.status(200).json({received: true});
    return;
  }

  // ── refund.failed ──────────────────────────────────────────────────────────
  if (eventType === "refund.failed") {
    const refundEntity = (
      (event.payload as Record<string, unknown> | undefined)?.refund as Record<string, unknown> | undefined
    )?.entity as Record<string, unknown> | undefined;
    const orderId  = (refundEntity?.notes as Record<string, unknown> | undefined)?.orderId as string | undefined;
    const refundId = refundEntity?.id as string | undefined;
    logger.warn("[webhook] refund.failed", {orderId, refundId});
    if (orderId) {
      try {
        await db.doc(`orders/${orderId}`).update({
          refundStatus: "FAILED",
          updatedAt: FieldValue.serverTimestamp(),
          timeline: FieldValue.arrayUnion({
            status: "REFUND_FAILED",
            note: `Refund ${refundId ?? ""} failed — contact Razorpay support`,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        logger.error("[webhook] refund.failed update error", err);
      }
    }
    res.status(200).json({received: true});
    return;
  }

  // Unhandled event — acknowledge so Razorpay doesn't keep retrying
  res.status(200).json({received: true});
}

