/* eslint-disable @typescript-eslint/no-non-null-assertion */
import Razorpay from "razorpay";
import {db} from "../config/firebase";
import {FieldValue} from "firebase-admin/firestore";
import {sendOrderEmail} from "../services/emailService";
import * as logger from "firebase-functions/logger";

// Initialize Razorpay with validation
let razorpay: Razorpay | null = null;

try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    logger.info("Razorpay initialized successfully for refund module");
  } else {
    logger.error("Razorpay credentials missing in refund module");
  }
} catch (error) {
  logger.error("Failed to initialize Razorpay in refund module", error);
}

/* -------------------------------------------------------------------------- */
/*                         INITIATE REFUND (AUTO)                             */
/* -------------------------------------------------------------------------- */

export async function initiateRefund(
  orderId: string,
  paymentId: string,
  amount?: number
) {
  if (!razorpay) {
    throw new Error("Razorpay not initialized - check credentials");
  }

  logger.info(`Initiating refund for order ${orderId}`, {
    paymentId,
    amount,
  });

  interface RazorpayRefundParams {
    notes: {
      orderId: string;
      [key: string]: string;
    };
    amount?: number;
  }

  try {
    // Razorpay refund - amount should be in paise (smallest unit)
    const refundParams: RazorpayRefundParams = {
      notes: {orderId},
    };

    // If amount is provided, include it (must be in paise)
    if (amount) {
      refundParams.amount = Math.round(amount * 100);
    }

    const refund = await razorpay.payments.refund(paymentId, refundParams);

    logger.info("Refund created successfully", {
      refundId: refund.id,
      status: refund.status,
    });

    // Update DB
    await db.doc(`orders/${orderId}`).update({
      paymentStatus: "REFUND_INITIATED",
      orderStatus: "REFUND_INITIATED",
      refundId: refund.id,
      refundedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion({
        status: "REFUND_INITIATED",
        note: `Refund initiated via Razorpay (ID: ${refund.id})`,
        timestamp: new Date().toISOString(),
      }),
    });

    return refund;
  } catch (error) {
    logger.error(`Refund initiation failed for order ${orderId}`, {
      error,
      paymentId,
      amount,
    });
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*                         REFUND WEBHOOK HANDLER                             */
/* -------------------------------------------------------------------------- */

interface RefundWebhookPayload {
  payload: {
    refund: {
      entity: {
        payment_id: string;
        [key: string]: unknown;
      };
    };
  };
}

export async function handleRefundWebhook(body: RefundWebhookPayload) {
  const paymentId = body.payload.refund.entity.payment_id;
  const orderRecord = await db
    .collection("orders")
    .where("paymentId", "==", paymentId)
    .limit(1)
    .get();

  if (orderRecord.empty) return;

  const order = orderRecord.docs[0];
  const orderId = order.id;

  await order.ref.update({
    paymentStatus: "REFUNDED",
    orderStatus: "REFUNDED",
    timeline: FieldValue.arrayUnion({
      status: "REFUNDED",
      note: "Refund successfully completed",
      timestamp: new Date().toISOString(),
    }),
  });

  await sendOrderEmail("payment_cancelled", {
    orderId: orderId,
    contactEmail: order.data().contactEmail,
    userEmail: order.data().userEmail,
    totalAmount: order.data().totalAmount,
    amount: order.data().totalAmount,
    paymentId: null,
    paymentStatus: "REFUNDED",
    orderStatus: "REFUNDED",
    items: order.data().items,
    billingAddress: order.data().billingAddress,
    shippingAddress: order.data().shippingAddress,
  });
}
