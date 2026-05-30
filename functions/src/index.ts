import * as dotenv from "dotenv";
dotenv.config();

import "./config/firebase";

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import app from "./app";
import {
  razorpayKeyId,
  razorpayKeySecret,
  razorpayWebhookSecret,
} from "./secrets";

setGlobalOptions({maxInstances: 10, region: "asia-south1"});

console.log("razorpayKeyId app.ts :", razorpayKeyId);

export const api = onRequest(
  {secrets: [razorpayKeyId, razorpayKeySecret, razorpayWebhookSecret]},
  app
);
