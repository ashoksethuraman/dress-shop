/* eslint-disable @typescript-eslint/no-non-null-assertion */
import Razorpay from "razorpay";
import {db} from "../config/firebase";
import {FieldValue} from "firebase-admin/firestore";
import {sendOrderEmail} from "../services/emailService";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

/* -------------------------------------------------------------------------- */
/*                         INITIATE REFUND (AUTO)                             */
/* -------------------------------------------------------------------------- */

export async function initiateRefund(orderId: string, paymentId: string) {
  // Razorpay refund
  const refund = await razorpay.payments.refund(paymentId, {});

  // Update DB
  await db.doc(`orders/${orderId}`).update({
    paymentStatus: "REFUND_INITIATED",
    orderStatus: "REFUND_INITIATED",
    refundedAt: FieldValue.serverTimestamp(),
    timeline: FieldValue.arrayUnion({
      status: "REFUND_INITIATED",
      note: "Refund initiated via Razorpay",
      timestamp: new Date().toISOString(),
    }),
  });

  return refund;
}

/* -------------------------------------------------------------------------- */
/*                         REFUND WEBHOOK HANDLER                             */
/* -------------------------------------------------------------------------- */

export async function handleRefundWebhook(body: any) {
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
