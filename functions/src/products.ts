import { onRequest } from "firebase-functions/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { setCors, verifyToken, requireAdmin } from "./helpers";

type StockStatus = 'available' | 'out_of_stock';

interface ProductBody {
  title?: string;
  description?: string;
  price?: number;
  category?: "men" | "women";
  images?: string[];
  sizes?: string[];
  /** 'available' | 'out_of_stock' | numeric count */
  stock?: StockStatus;
}

/** Returns true if the product should be visible in the public listing. */
function isInStock(stock: unknown): boolean {
  if (stock === 'out_of_stock') return false;
  return true; // 'available' or missing legacy docs — treat as available
}

// ── GET /apiGetProducts ─────────────────────────────────────────────────────
// Public endpoint — no authentication required.
export const apiGetProducts = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  console.log('api get products')
  logger.info("[apiGetProducts] →", { method: req.method });
  if (req.method !== "GET") { res.status(405).send("Method Not Allowed"); return; }

  try {
    const snap = await admin.firestore()
      .collection("products")
      .orderBy("createdAt", "desc")
      .get();

    const allProducts = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      // Convert Firestore Timestamp to ISO string for JSON serialisation
      createdAt: (d.data().createdAt as admin.firestore.Timestamp)?.toDate?.()?.toISOString() ?? null,
    }));

    // Only return products that are in stock (hide out_of_stock / zero-qty)
    const products = allProducts.filter((p) => isInStock((p as any).stock));
    logger.info(`[apiGetProducts] total=${allProducts.length} visible=${products.length}`);
    res.json({ products });
  } catch (err) {
    logger.error("getProducts error", err);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

// ── GET /apiGetProductById?id=<productId> ──────────────────────────────────
// Public endpoint — no authentication required.
export const apiGetProductById = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiGetProductById] →", { method: req.method, id: req.query.id });
  if (req.method !== "GET") { res.status(405).send("Method Not Allowed"); return; }

  const id = req.query.id as string;
  if (!id) { res.status(400).json({ error: "id query param required." }); return; }

  try {
    const snap = await admin.firestore().doc(`products/${id}`).get();
    if (!snap.exists) { res.status(404).json({ error: "Product not found." }); return; }
    res.json({ id: snap.id, ...snap.data() });
  } catch (err) {
    logger.error("getProductById error", err);
    res.status(500).json({ error: "Failed to fetch product." });
  }
});

// ── POST /apiAddProduct ─────────────────────────────────────────────────────
// Admin only.  Body: { title, description?, price, category?, images?, sizes? }
export const apiAddProduct = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiAddProduct] →", { method: req.method, body: { title: req.body?.title, price: req.body?.price, category: req.body?.category } });
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await verifyToken(req, res);
  if (!decoded) return;
  if (!requireAdmin(decoded, res)) return;

  const { title, description, price, category, images, sizes, stock } =
    req.body as ProductBody;

  if (!title || price == null) {
    res.status(400).json({ error: "title and price are required." });
    return;
  }

  try {
    const ref = admin.firestore().collection("products").doc(); // pre-generate ID
    await ref.set({
      id: ref.id,                       // store as field for self-containedness
      title,
      description: description ?? "",
      price: Number(price),
      category: category ?? "women",
      images: images ?? [],
      sizes: sizes ?? [],
      image: images?.[0] ?? "",
      stock: stock ?? 'available',
      createdAt: FieldValue.serverTimestamp(),
    });
    logger.info(`Product added: ${ref.id} by ${decoded.uid}`);
    res.status(201).json({ id: ref.id });
  } catch (err) {
    logger.error("addProduct error", err);
    res.status(500).json({ error: "Failed to add product." });
  }
});

// ── PUT /apiUpdateProduct?id=<productId> ───────────────────────────────────
// Admin only.  Partial update — only supplied fields are changed.
export const apiUpdateProduct = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiUpdateProduct] →", { method: req.method, id: req.query.id });
  if (req.method !== "PUT") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await verifyToken(req, res);
  if (!decoded) return;
  if (!requireAdmin(decoded, res)) return;

  const id = req.query.id as string;
  if (!id) { res.status(400).json({ error: "id query param required." }); return; }

  const { title, description, price, category, images, sizes, stock } =
    req.body as ProductBody;

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = Number(price);
  if (category !== undefined) updates.category = category;
  if (images !== undefined) { updates.images = images; updates.image = images[0] ?? ""; }
  if (sizes !== undefined) updates.sizes = sizes;
  if (stock !== undefined) updates.stock = stock;

  try {
    await admin.firestore().doc(`products/${id}`).update(updates);
    logger.info(`[apiUpdateProduct] Product updated: ${id} by ${decoded?.uid}`);
    res.json({ success: true });
  } catch (err) {
    logger.error("updateProduct error", err);
    res.status(500).json({ error: "Failed to update product." });
  }
});

// ── DELETE /apiDeleteProduct?id=<productId> ────────────────────────────────
// Admin only.
export const apiDeleteProduct = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiDeleteProduct] →", { method: req.method, id: req.query.id });
  if (req.method !== "DELETE") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await verifyToken(req, res);
  if (!decoded) return;
  if (!requireAdmin(decoded, res)) return;

  const id = req.query.id as string;
  if (!id) { res.status(400).json({ error: "id query param required." }); return; }

  try {
    await admin.firestore().doc(`products/${id}`).delete();
    logger.info(`Product deleted: ${id} by ${decoded.uid}`);
    res.json({ success: true });
  } catch (err) {
    logger.error("deleteProduct error", err);
    res.status(500).json({ error: "Failed to delete product." });
  }
});
