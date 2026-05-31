/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {Router, type Request, type Response} from "express";
import {FieldValue} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db, admin} from "../config/firebase";
import {authenticate, requireAdmin, validate, sanitizeParam} from "../middleware";
import {type CreateProductBody, type UpdateProductBody} from "../types";
import {validateCreateProduct, validateUpdateProduct} from "../validators";


export const productsRouter = Router();

function parseStorageObjectPathFromUrl(url: string): string | null {
  if (typeof url !== "string" || url.length === 0) return null;
  const m = url.match(/\/o\/([^?]+)/);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

function deriveImageRefs(images: string[]): { imagePaths: string[]; imageNames: string[] } {
  const imagePaths = images
    .map(parseStorageObjectPathFromUrl)
    .filter((p): p is string => !!p);

  const imageNames = imagePaths
    .map((p) => p.split("/").pop() ?? "")
    .filter((n) => n.length > 0);

  return {imagePaths, imageNames};
}

function deriveSingleRef(url?: string | null): { path: string | null; name: string | null } {
  if (!url) return {path: null, name: null};
  const path = parseStorageObjectPathFromUrl(url);
  if (!path) return {path: null, name: null};
  const name = path.split("/").pop() ?? null;
  return {path, name};
}

productsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const q =
      typeof req.query.q === "string" ?
        req.query.q.trim().toLowerCase() :
        "";

    const requestedLimit = Number(req.query.limit);

    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0 ?
        Math.min(requestedLimit, 50) :
        10;

    const lastDocId =
      typeof req.query.lastDocId === "string" ?
        req.query.lastDocId :
        undefined;

    const sortBy =
      typeof req.query.sortBy === "string" ?
        req.query.sortBy :
        undefined;

    const category =
      typeof req.query.category === "string" ?
        req.query.category.trim().toLowerCase() :
        undefined;

    const type =
      typeof req.query.type === "string" ?
        req.query.type.trim() :
        undefined;

    const availability =
      typeof req.query.availability === "string" ?
        req.query.availability.trim().toLowerCase() :
        undefined;

    let query: FirebaseFirestore.Query = db.collection("products");

    // Category
    if (category) {
      query = query.where("category", "==", category);
    }

    // Type
    if (type) {
      query = query.where("type", "==", type);
    }

    // Availability
    if (availability) {
      const stockVal =
        availability === "in-stock" ?
          "available" :
          availability === "out-of-stock" ?
            "out_of_stock" :
            null;

      if (stockVal) {
        query = query.where("stock", "==", stockVal);
      }
    }

    // Search
    if (q) {
      query = query
        .where("titleLower", ">=", q)
        .where("titleLower", "<=", q + "\uf8ff")
        .orderBy("titleLower")
        .orderBy("createdAt", "desc");
    } else {
      if (sortBy === "bestsellers") {
        query = query
          .orderBy("salesCount", "desc")
          .orderBy("createdAt", "desc");
      } else {
        query = query.orderBy("createdAt", "desc");
      }
    }

    let firestoreQuery = query.limit(limit + 1);

    if (lastDocId) {
      const lastSnap = await db.doc(`products/${lastDocId}`).get();

      if (lastSnap.exists) {
        firestoreQuery = firestoreQuery.startAfter(lastSnap);
        // startAfter( lastSnap.get("titleLower"),  lastSnap.get("createdAt"))
      }
    }

    const snap = await firestoreQuery.get();

    const docs = snap.docs;

    const hasMore = docs.length > limit;

    const take = hasMore ? docs.slice(0, limit) : docs;

    const products = take.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt:
        (d.data().createdAt as FirebaseFirestore.Timestamp)
          ?.toDate?.()
          ?.toISOString() ?? null,
    }));

    const lastVisibleId =
      take.length > 0 ?
        take[take.length - 1].id :
        undefined;

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );

    logger.info(
      `[GET /products] q="${q}" category="${category}" type="${type}" returned=${products.length} hasMore=${hasMore}`
    );

    res.json({
      products,
      hasMore,
      lastDocId: lastVisibleId,
    });
  } catch (err) {
    logger.error("[GET /products] error", err);

    res.status(500).json({
      error: "Failed to fetch products.",
    });
  }
});

productsRouter.get("/admin", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection("products").orderBy("createdAt", "desc").get();
    const products = snap.docs.map((d) => ({
      id: d.id, ...d.data(),
      createdAt: (d.data().createdAt as FirebaseFirestore.Timestamp)?.toDate?.()?.toISOString() ?? null,
    }));
    logger.info(`[GET /products/admin] count=${products.length}`);
    res.json({products});
  } catch (err) {
    logger.error("[GET /products/admin] error", err);
    res.status(500).json({error: "Failed to fetch products."});
  }
});

productsRouter.get("/:id", sanitizeParam("id"), async (req: Request, res: Response) => {
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

productsRouter.post("/", authenticate, requireAdmin, validate(validateCreateProduct), async (req: Request, res: Response) => {
  const body = req.body as CreateProductBody;
  try {
    const ref = db.collection("products").doc();
    const images = body.images ?? [];
    // hiding no need refrence
    // const {imagePaths, imageNames} = deriveImageRefs(images);
    // const sizeChartRef = deriveSingleRef(body.sizeChart ?? null);

    await ref.set({
      id: ref.id,
      title: body.title,
      titleLower: body.title.toLowerCase(),
      productCode: body.productCode,
      description: body.description ?? "",
      price: Number(body.price),
      category: (body.category ?? "women").toString().trim().toLowerCase(),
      type: body.type ?? null,
      images,
      sizes: body.sizes ?? [],
      // imagePaths,
      // imageNames,
      sizeInventory: body.sizeInventory ?? {},
      ageSizes: body.ageSizes ?? [],
      ageSizeInventory: body.ageSizeInventory ?? {},
      // image: images[0] ?? "",
      stock: body.stock ?? "available",
      sizeChart: body.sizeChart ?? null,
      shippingAndDelivery: body.shippingAndDelivery ?? null,
      exchangeAndReturns: body.exchangeAndReturns ?? null,
      // sizeChartPath: sizeChartRef.path,
      // sizeChartName: sizeChartRef.name,
      salesCount: 0,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`[POST /products] Added: ${ref.id} by ${req.user!.uid}`);
    res.status(201).json({id: ref.id});
  } catch (err) {
    logger.error("[POST /products] error", err);
    res.status(500).json({error: "Failed to add product."});
  }
});

productsRouter.put("/:id", authenticate, requireAdmin, sanitizeParam("id"), validate(validateUpdateProduct), async (req: Request, res: Response) => {
  const {id} = req.params;
  const body = req.body as UpdateProductBody;
  const updates: Record<string, unknown> = {updatedAt: FieldValue.serverTimestamp()};
  if (body.title !== undefined) updates.title = body.title;
  if (body.title !== undefined) updates.titleLower = body.title.toLowerCase();
  if (body.description !== undefined) updates.description = body.description;
  if (body.price !== undefined) updates.price = Number(body.price);
  if (body.category !== undefined && body.category !== null) updates.category = String(body.category).trim().toLowerCase();
  if (body.type !== undefined) updates.type = body.type;
  if (body.images !== undefined) {
    const {imagePaths, imageNames} = deriveImageRefs(body.images);
    updates.images = body.images;
    updates.image = body.images[0] ?? "";
    updates.imagePaths = imagePaths;
    updates.imageNames = imageNames;
  }
  if (body.sizes !== undefined) updates.sizes = body.sizes;
  if (body.sizeInventory !== undefined) updates.sizeInventory = body.sizeInventory;
  if (body.ageSizes !== undefined) updates.ageSizes = body.ageSizes;
  if (body.ageSizeInventory !== undefined) updates.ageSizeInventory = body.ageSizeInventory;
  if (body.stock !== undefined) updates.stock = body.stock;
  if (body.sizeChart !== undefined) {
    const sizeChartRef = deriveSingleRef(body.sizeChart ?? null);
    updates.sizeChart = body.sizeChart;
    updates.sizeChartPath = sizeChartRef.path;
    updates.sizeChartName = sizeChartRef.name;
  }
  if (body.shippingAndDelivery !== undefined) updates.shippingAndDelivery = body.shippingAndDelivery;
  if (body.exchangeAndReturns !== undefined) updates.exchangeAndReturns = body.exchangeAndReturns;
  try {
    await db.doc(`products/${id}`).update(updates);
    logger.info(`[PUT /products/:id] Updated: ${id} by ${req.user!.uid}`);
    res.json({success: true});
  } catch (err) {
    logger.error("[PUT /products/:id] error", err);
    res.status(500).json({error: "Failed to update product."});
  }
});

productsRouter.delete("/:id", authenticate, requireAdmin, sanitizeParam("id"), async (req: Request, res: Response) => {
  const {id} = req.params;
  const {images} = req.body as { images?: string[] };
  logger.info(`[Image] delete : ${images}`);
  try {
    await db.doc(`products/${id}`).delete();
    logger.info(`[DELETE /products/:id] Deleted: ${id} by ${req.user!.uid}`);
    // 2. Delete images from Cloud Storage (if provided)
    if (images && Array.isArray(images)) {
      const bucket = admin.storage().bucket();
      const deleteOps = images.map((path) =>
        bucket.file(path).delete().catch((err) => {
          // Log error but don’t stop deletion
          logger.warn(`Image delete failed: ${path}`, err);
        })
      );
      await Promise.all(deleteOps);
    }
    res.json({success: true});
  } catch (err) {
    logger.error("[DELETE /products/:id] error", err);
    res.status(500).json({error: "Failed to delete product."});
  }
});

