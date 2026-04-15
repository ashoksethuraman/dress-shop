import express, { type Request, type Response, type NextFunction } from "express";
import * as logger from "firebase-functions/logger";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { corsMiddleware, csrfProtection } from "./middleware";
import {
  globalLimiter,
} from "./config";

import { productsRouter } from "./routes/products";
import { ordersRouter } from "./routes/orders";
import { paymentsRouter } from "./routes/payments";
import { imagesRouter } from "./routes/images";
import { usersRouter } from "./routes/users";

const app = express();

// -------------------- CORE MIDDLEWARE --------------------
app.set("trust proxy", 1);
app.use(helmet());
app.disable("x-powered-by");
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Security middleware
app.use(corsMiddleware);
app.use(csrfProtection);

// Global rate limit (applies to all routes)
app.use(globalLimiter);

// -------------------- REQUEST LOGGER --------------------
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug("[app] Incoming request", { method: req.method, url: req.originalUrl, body: req.body });
  next();
});

// -------------------- ROUTES --------------------
// IMPORTANT: Only mount routers here

app.use("/products", productsRouter);
app.use("/orders", ordersRouter);
app.use("/payments", paymentsRouter);
app.use("/images", imagesRouter);
app.use("/users", usersRouter);

// -------------------- 404 HANDLER --------------------
app.use((_req: Request, res: Response) => {
  logger.debug("[app] 404 Not Found", { method: _req.method, url: _req.originalUrl, body: _req.body });
  res.status(404).json({ error: "Not found." });
});

// -------------------- ERROR HANDLER --------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("[app] Unhandled error", err);
  res.status(500).json({ error: "Internal server error." });
});

export default app;