/**
 * app.ts — Express application.
 *
 * Mounts all feature routers under their respective path prefixes and
 * registers the global 404 / error‑handler middleware at the end.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import * as logger from "firebase-functions/logger";
import { corsMiddleware } from "./middleware";
import { productsRouter } from "./routes/products";
import { ordersRouter }   from "./routes/orders";
import { paymentsRouter } from "./routes/payments";
import { imagesRouter }   from "./routes/images";
import { usersRouter }    from "./routes/users";

const app = express();

// Parse incoming JSON bodies
app.use(express.json());

// CORS — applied globally before all routes
app.use(corsMiddleware);

// ── Feature routers ────────────────────────────────────────────────────────
app.use("/products",  productsRouter);
app.use("/orders",    ordersRouter);
app.use("/payments",  paymentsRouter);
app.use("/images",    imagesRouter);
app.use("/users",     usersRouter);

// ── 404 fallback ───────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found." });
});

// ── Global error handler ───────────────────────────────────────────────────
// Express recognises a 4‑argument function as an error handler.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("[app] Unhandled error", err);
  res.status(500).json({ error: "Internal server error." });
});

export default app;
