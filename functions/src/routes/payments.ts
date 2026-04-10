import {Router, type Request, type Response} from "express";
import {FieldValue} from "firebase-admin/firestore";
import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import {db} from "../firebase";
import {optionalAuth, validate} from "../middleware";
import {sendOrderEmail, type OrderEmailPayload} from "../emailService";
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

const enforceRazorpaySignature = (process.env.ENFORCE_RAZORPAY_SIGNATURE ?? "true").toLowerCase() === "true";
const allowMockPayments = (process.env.ALLOW_MOCK_PAYMENTS ??
  (process.env.NODE_ENV === "production" ? "false" : "true")).toLowerCase() === "true";

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

async function deductInventory(
  orderId: string,
  items: Array<{ productId?: unknown; size?: unknown; qty?: unknown }>
): Promise<void> {
  const byProduct = new Map<string, Array<{ size: string | null; qty: number }>>();
  for (const item of items) {
    const productId = typeof item.productId === "string" ? item.productId : null;
    if (!productId) continue;
    const size = typeof item.size === "string" ? item.size : null;
    const qty = typeof item.qty === "number" && item.qty > 0 ? item.qty : 0;
    if (!qty) continue;
    if (!byProduct.has(productId)) byProduct.set(productId, []);
    byProduct.get(productId)!.push({size, qty});
  }

  await Promise.all(
    Array.from(byProduct.entries()).map(async ([productId, sizeQtys]) => {
      const ref = db.doc(`products/${productId}`);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const data = snap.data()!;
          const inv: Record<string, number> = {...(data.sizeInventory ?? {})};

          for (const {size, qty} of sizeQtys) {
            if (size === null) {
              if (typeof inv["__noSize"] === "number") {
                inv["__noSize"] = Math.max(0, inv["__noSize"] - qty);
              }
            } else if (typeof inv[size] === "number") {
              inv[size] = Math.max(0, inv[size] - qty);
            }
          }

          const currentSales = (data.salesCount as number | undefined) ?? 0;
          const unitsSold = sizeQtys.reduce((s, x) => s + x.qty, 0);
          tx.update(ref, {
            sizeInventory: inv,
            salesCount: currentSales + unitsSold,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        logger.info(`[deductInventory] product ${productId} updated for order ${orderId}`);
      } catch (err) {
        logger.error(`[deductInventory] failed for product ${productId}`, err);
        // Non-fatal — payment is already confirmed
      }
    })
  );
}

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

    if (enforceRazorpaySignature && !keySecret) {
      res.status(503).json({error: "RAZORPAY_KEY_SECRET is required for payment verification."});
      return;
    }

    if (enforceRazorpaySignature && !razorpay_order_id) {
      res.status(400).json({error: "razorpay_order_id is required for signature verification."});
      return;
    }

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

      if (req.user && orderData.userId !== req.user.uid && req.user.role !== "admin") {
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

      // Deduct inventory (non-fatal — runs after payment is confirmed)
      deductInventory(orderId, orderData.items ?? []).catch(() => {/* already logged */});

      sendOrderEmail("payment_success", {
        ...toOrderEmailPayload(orderId, orderData, razorpay_payment_id),
        paymentStatus: "SUCCESS",
        orderStatus: "PLACED",
      }).catch((mailErr) => logger.error("[mail] payment_success failed", {orderId, error: mailErr}));

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

      if (req.user && orderData.userId !== req.user.uid && req.user.role !== "admin") {
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

      sendOrderEmail(
        reason === "payment_failed" ? "payment_failed" : "payment_cancelled",
        {
          ...toOrderEmailPayload(orderId, orderData),
          paymentStatus: newPaymentStatus,
          orderStatus: newOrderStatus,
        }
      ).catch((mailErr) => logger.error("[mail] payment_fail/cancel failed", {orderId, error: mailErr}));

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
    if (!allowMockPayments) {
      res.status(403).json({error: "Mock payment recording is disabled in this environment."});
      return;
    }

    const body = req.body as RecordPaymentBody;

    try {
      const orderSnap = await db.doc(`orders/${body.orderId}`).get();
      if (!orderSnap.exists) {
        res.status(404).json({error: "Order not found."}); return;
      }

      const orderData = orderSnap.data()!;

      if (req.user && orderData.userId !== req.user.uid && req.user.role !== "admin") {
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

      // Deduct inventory (non-fatal — runs after payment is confirmed)
      deductInventory(body.orderId, orderData.items ?? []).catch(() => {/* already logged */});

      sendOrderEmail("payment_success", {
        ...toOrderEmailPayload(body.orderId, orderData, body.paymentId),
        paymentStatus: "SUCCESS",
        orderStatus: "PLACED",
      }).catch((mailErr) => logger.error("[mail] payment_success(record) failed", {orderId: body.orderId, error: mailErr}));

      logger.info(`[POST /payments/record] Recorded ${body.paymentId} for order ${body.orderId} (isTest: ${body.isTest ?? true})`);
      res.status(201).json({success: true, paymentId: body.paymentId});
    } catch (err) {
      logger.error("[POST /payments/record] error", err);
      res.status(500).json({error: "Failed to record payment."});
    }
  }
);
