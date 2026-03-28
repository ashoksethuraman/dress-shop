import {Router, type Request, type Response} from "express";
import {FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../firebase";
import {authenticate, requireAdmin, validate} from "../middleware";
import {
  type CreateProductBody,
  type UpdateProductBody,
  validateCreateProduct,
  validateUpdateProduct,
} from "../schemas";

export const productsRouter = Router();

function isInStock(stock: unknown): boolean {
  return stock !== "out_of_stock";
}


productsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection("products").orderBy("createdAt", "desc").get();
    const all = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as FirebaseFirestore.Timestamp)?.toDate?.()?.toISOString() ?? null,
    }));
    const products = all.filter((p) => isInStock((p as Record<string, unknown>).stock));
    logger.info(`[GET /products] total=${all.length} visible=${products.length}`);
    res.json({products});
  } catch (err) {
    logger.error("[GET /products] error", err);
    res.status(500).json({error: "Failed to fetch products."});
  }
});

productsRouter.get("/admin", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection("products").orderBy("createdAt", "desc").get();
    const products = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: (d.data().createdAt as FirebaseFirestore.Timestamp)?.toDate?.()?.toISOString() ?? null,
    }));
    logger.info(`[GET /products/admin] count=${products.length}`);
    res.json({products});
  } catch (err) {
    logger.error("[GET /products/admin] error", err);
    res.status(500).json({error: "Failed to fetch products."});
  }
});

productsRouter.get("/:id", async (req: Request, res: Response) => {
  const {id} = req.params;
  try {
    const snap = await db.doc(`products/${id}`).get();
    if (!snap.exists) {
      res.status(404).json({error: "Product not found."}); return;
    }
    res.json({id: snap.id, ...snap.data()});
  } catch (err) {
    logger.error("[GET /products/:id] error", err);
    res.status(500).json({error: "Failed to fetch product."});
  }
});


productsRouter.post(
  "/",
  authenticate,
  requireAdmin,
  validate(validateCreateProduct),
  async (req: Request, res: Response) => {
    const body = req.body as CreateProductBody;
    try {
      const ref = db.collection("products").doc();
      await ref.set({
        id: ref.id,
        title: body.title,
        description: body.description ?? "",
        price: Number(body.price),
        category: body.category ?? "women",
        images: body.images ?? [],
        sizes: body.sizes ?? [],
        image: body.images?.[0] ?? "",
        stock: body.stock ?? "available",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.info(`[POST /products] Added: ${ref.id} by ${req.user!.uid}`);
      res.status(201).json({id: ref.id});
    } catch (err) {
      logger.error("[POST /products] error", err);
      res.status(500).json({error: "Failed to add product."});
    }
  }
);


productsRouter.put(
  "/:id",
  authenticate,
  requireAdmin,
  validate(validateUpdateProduct),
  async (req: Request, res: Response) => {
    const {id} = req.params;
    const body = req.body as UpdateProductBody;

    const updates: Record<string, unknown> = {updatedAt: FieldValue.serverTimestamp()};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.price !== undefined) updates.price = Number(body.price);
    if (body.category !== undefined) updates.category = body.category;
    if (body.images !== undefined) {
      updates.images = body.images; updates.image = body.images[0] ?? "";
    }
    if (body.sizes !== undefined) updates.sizes = body.sizes;
    if (body.stock !== undefined) updates.stock = body.stock;

    try {
      await db.doc(`products/${id}`).update(updates);
      logger.info(`[PUT /products/:id] Updated: ${id} by ${req.user!.uid}`);
      res.json({success: true});
    } catch (err) {
      logger.error("[PUT /products/:id] error", err);
      res.status(500).json({error: "Failed to update product."});
    }
  }
);

productsRouter.delete("/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  const {id} = req.params;
  try {
    await db.doc(`products/${id}`).delete();
    logger.info(`[DELETE /products/:id] Deleted: ${id} by ${req.user!.uid}`);
    res.json({success: true});
  } catch (err) {
    logger.error("[DELETE /products/:id] error", err);
    res.status(500).json({error: "Failed to delete product."});
  }
});
