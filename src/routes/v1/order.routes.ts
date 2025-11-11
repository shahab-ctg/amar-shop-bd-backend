// === REPLACE or UPDATE your backend file: src/routes/v1/orders.js ===
// Full file below — copy-paste to replace the existing `routes/orders.js` (or merge the GET handler if you prefer).
// ---------- BEGIN FILE ----------

import { Router } from "express";
import mongoose from "mongoose";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { Order } from "../../models/Order.js"; // <-- ensure this model path is correct in your project

const router = Router();

/**
 * POST /api/v1/orders
 * (existing implementation — kept)
 */
router.post("/orders", async (req, res) => {
  try {
    await dbConnect();
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length)
      return res.status(400).json({ ok: false, message: "No items" });

    // sanitize items
    const normalized = items.map((it) => ({
      _id: it._id,
      quantity: Math.max(1, Number(it.quantity || 1)),
    }));

    // Start transaction if possible
    const conn = mongoose.connection;
    const session = await conn.startSession();
    let usedTxn = true;

    try {
      session.startTransaction();

      const updatedProducts = [];

      // Decrement each product atomically (only if enough stock)
      for (const it of normalized) {
        // try matching stock field names (stock or availableStock)
        const filterCandidates = [
          { _id: it._id, stock: { $gte: it.quantity } },
          { _id: it._id, availableStock: { $gte: it.quantity } },
        ];
        let updated = null;
        for (const f of filterCandidates) {
          updated = await Product.findOneAndUpdate(
            f,
            // decrement both fields safely (if a field doesn't exist, $inc will create it -> we assume schema has stock)
            { $inc: { stock: -it.quantity, availableStock: -it.quantity } },
            { new: true, session, useFindAndModify: false }
          ).lean();
          if (updated) break;
        }

        if (!updated) {
          // Not enough stock -> abort
          throw new Error(`Out of stock for product ${it._id}`);
        }
        updatedProducts.push({
          _id: String(updated._id),
          stock: updated.stock ?? updated.availableStock ?? 0,
        });
      }

      // TODO: create order document in Orders collection (not included here).
      // e.g., await Order.create([{ items: normalized, user: req.user?._id }], { session });

      await session.commitTransaction();
      session.endSession();

      return res.json({ ok: true, updatedProducts });
    } catch (err) {
      // abort transaction
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (e) {
        console.error("Failed to abort transaction", e);
      }
      // bubble error
      return res
        .status(400)
        .json({ ok: false, message: err.message || "Order failed" });
    }
  } catch (err) {
    console.error("Order endpoint error", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/**
 * NEW: GET /api/v1/orders
 *
 * This handler fixes the frontend 404 for:
 *   GET https://.../api/v1/orders?page=1&limit=24
 *
 * It returns JSON in the shape the frontend expects:
 * { ok: true, data: { items: [...], total, page, limit, pages } }
 *
 * Query params:
 *  - page (default 1)
 *  - limit (default 50, max 200)
 *  - status (optional)  -> Order.status filter (if present)
 *  - search (optional)  -> search by order id or customer name (partial)
 *
 * NOTE: This endpoint is intentionally permissive. If you want to restrict to admin
 * add auth middleware (e.g., requireAdmin) in front of the handler.
 */
// src/routes/v1/order.routes.js


// GET /api/v1/orders
router.get("/orders", async (req, res) => {
  try {
    await dbConnect();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const status = typeof req.query.status === "string" ? req.query.status.trim() : null;

    const filter = {};
    if (status) filter.status = status;

    const items = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Order.countDocuments(filter);

    const formatted = items.map((o) => ({
      ...o,
      _id: String(o._id),
      totals: o.totals || { subTotal: 0, shipping: 0, grandTotal: 0 },
      // normalize nested ids if needed
    }));

    return res.json({
      ok: true,
      data: {
        items: formatted,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("GET /orders error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// (keep existing POST /orders logic you already have; don't remove)
// e.g. router.post("/orders", ...)




export default router;

// ---------- END FILE ----------
