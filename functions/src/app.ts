import express, {type Request, type Response, type NextFunction} from "express";
import * as logger from "firebase-functions/logger";
import helmet from "helmet";
import {corsMiddleware} from "./middleware";
import {
  globalLimiter, authLimiter, writeLimiter,
  paymentLimiter, readLimiter, uploadLimiter,
} from "./rateLimits";
import {productsRouter} from "./routes/products";
import {ordersRouter} from "./routes/orders";
import {paymentsRouter} from "./routes/payments";
import {imagesRouter} from "./routes/images";
import {usersRouter} from "./routes/users";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.disable("x-powered-by");
app.use(express.json({limit: "64kb"}));

app.use(corsMiddleware);

app.use(globalLimiter);

app.use("/users/signup", authLimiter);
app.use("/users/login", authLimiter);
app.use("/payments", paymentLimiter);
app.use("/images", uploadLimiter);

app.get( "/products", readLimiter);
app.get( "/products/admin", readLimiter);
app.get( "/products/:id", readLimiter);
app.post("/products", writeLimiter);
app.put( "/products/:id", writeLimiter);
app.delete("/products/:id", writeLimiter);

app.post("/orders", writeLimiter);
app.get( "/orders", readLimiter);
app.get( "/orders/me", readLimiter);
app.get( "/orders/track/:id", readLimiter);
app.get( "/orders/:id", readLimiter);
app.post("/orders/:id/status", writeLimiter);
app.get(  "/users/all",    readLimiter);
app.patch("/users/status", writeLimiter);
app.use("/products", productsRouter);
app.use("/orders", ordersRouter);
app.use("/payments", paymentsRouter);
app.use("/images", imagesRouter);
app.use("/users", usersRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({error: "Not found."});
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("[app] Unhandled error", err);
  res.status(500).json({error: "Internal server error."});
});

export default app;
