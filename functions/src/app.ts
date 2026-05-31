import express, {type Request, type Response, type NextFunction} from "express";
import {sanitizedLogger} from "./utils/logger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
// authenticate
import {corsMiddleware, browserOnlyMiddleware} from "./middleware";
import {
  globalLimiter,
} from "./config";

import {productsRouter} from "./routes/products";
import {ordersRouter} from "./routes/orders";
import {paymentsRouter, razorpayWebhookHandler} from "./routes/payments";
import {imagesRouter} from "./routes/images";
import {usersRouter} from "./routes/users";
import {configRouter} from "./routes/config";

const app = express();

// -------------------- CORE MIDDLEWARE --------------------
app.set("trust proxy", 1);
app.use(helmet());
app.disable("x-powered-by");
app.use(cookieParser());

// Razorpay webhook needs the raw body for HMAC-SHA256 verification.
// Mount it with express.raw() BEFORE express.json() so the Buffer is preserved.
app.post("/api/payments/webhook", express.raw({type: "application/json"}), razorpayWebhookHandler);

app.use(express.json({limit: "1mb"}));

// Security middleware
app.use(corsMiddleware);
app.use(browserOnlyMiddleware); // ← Blocks Postman/curl/Thunder Client
// app.use(csrfProtection);

// Global rate limit (applies to all routes)
app.use(globalLimiter);

// -------------------- REQUEST LOGGER --------------------
app.use((req: Request, _res: Response, next: NextFunction) => {
  sanitizedLogger.debug("[app] Incoming request", {method: req.method, url: req.originalUrl, body: req.body});
  next();
});

// -------------------- NO-CACHE FOR DYNAMIC API RESPONSES --------------------
// Prevent CDN / browser caching for API responses that serve dynamic product data.
// app.use((req: Request, res: Response, next: NextFunction) => {
//   try {
//     const url = req.originalUrl || req.url || '';
//     const isApiPath = url.startsWith('/api/') || url.startsWith('/products') || url.startsWith('/orders');
//     if (isApiPath && req.method === 'GET') {
//       // Strongly discourage any caching in browsers, proxies, or CDN
//       res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0');
//       res.setHeader('Pragma', 'no-cache');
//       res.setHeader('Expires', '0');
//     }
//   } catch (e) {
//     // ignore header setting issues
//   }
//   next();
// });

// -------------------- ROUTES --------------------
// IMPORTANT: Routes must include /api prefix because Firebase Hosting forwards the full path

app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/images", imagesRouter);
app.use("/api/users", usersRouter);
app.use("/api/config", configRouter);

app.use((_req: Request, res: Response) => {
  sanitizedLogger.debug("[app] 404 Not Found", {method: _req.method, url: _req.originalUrl, body: _req.body});
  res.status(404).json({error: "Not found."});
});

// -------------------- ERROR HANDLER --------------------
app.use((err: Error, _req: Request, res: Response) => {
  sanitizedLogger.error("[app] Unhandled error", err);
  res.status(500).json({error: "Internal server error."});
});


export default app;
