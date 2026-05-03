import * as dotenv from "dotenv";
dotenv.config();

console.log("KEY index:", process.env.RAZORPAY_KEY_ID);
import "./config/firebase";

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import app from "./app";

setGlobalOptions({maxInstances: 10, region: "asia-south1"});

export const api = onRequest(app);
