import {defineSecret} from "firebase-functions/params";

export const razorpayKeyId = defineSecret("RAZORPAY_KEY_ID");
export const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
export const razorpayWebhookSecret = defineSecret("RAZORPAY_WEBHOOK_SECRET");
