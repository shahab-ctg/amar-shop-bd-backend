// src/routes/v1/order.routes.ts
import { Router } from "express";
import mongoose from "mongoose";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { Order } from "../../models/Order.js"; // <-- ensure this model path is correct in your project
const router = Router();
/**
 * POST /api/v1/orders
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
                const filterCandidates = [
                    { _id: it._id, stock: { $gte: it.quantity } },
                    { _id: it._id, availableStock: { $gte: it.quantity } },
                ];
                let updated = null;
                for (const f of filterCandidates) {
                    updated = await Product.findOneAndUpdate(f, { $inc: { stock: -it.quantity, availableStock: -it.quantity } }, { new: true, session, useFindAndModify: false }).lean();
                    if (updated)
                        break;
                }
                if (!updated) {
                    throw new Error(`Out of stock for product ${it._id}`);
                }
                updatedProducts.push({
                    _id: String(updated._id),
                    stock: updated.stock ?? updated.availableStock ?? 0,
                });
            }
            // TODO: create order document in Orders collection (not included here).
            await session.commitTransaction();
            session.endSession();
            return res.json({ ok: true, updatedProducts });
        }
        catch (err) {
            try {
                await session.abortTransaction();
                session.endSession();
            }
            catch (e) {
                console.error("Failed to abort transaction", e);
            }
            return res
                .status(400)
                .json({ ok: false, message: err.message || "Order failed" });
        }
    }
    catch (err) {
        console.error("Order endpoint error", err);
        return res.status(500).json({ ok: false, message: "Server error" });
    }
});
/**
 * GET /api/v1/orders
 */
router.get("/orders", async (req, res) => {
    try {
        await dbConnect();
        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
        const status = typeof req.query.status === "string" ? req.query.status.trim() : null;
        // make filter a flexible object so we can assign properties dynamically
        const filter = {};
        if (status)
            filter.status = status;
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
    }
    catch (err) {
        console.error("GET /orders error:", err);
        return res.status(500).json({ ok: false, message: "Server error" });
    }
});
export default router;
