import expressRateLimit, {ipKeyGenerator, type Options} from "express-rate-limit";

function makeLimit(max: number, windowMinutes: number, label: string) {
  return expressRateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {error: `Too many requests (${label}). Please try again later.`},
    skip: (req) => req.method === "OPTIONS",
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown"),
  } as Partial<Options>);
}

export const globalLimiter = makeLimit(300, 15, "global");
export const authLimiter = makeLimit(10, 15, "auth");
export const writeLimiter = makeLimit(60, 15, "write");
export const paymentLimiter = makeLimit(30, 15, "payment");
export const readLimiter = makeLimit(200, 15, "read");
export const uploadLimiter = makeLimit(20, 15, "upload");
