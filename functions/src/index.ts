import "./firebase";

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import app from "./app";

setGlobalOptions({maxInstances: 10, region: "asia-south1"});

export const api = onRequest(
  {secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]},
  app,
);
