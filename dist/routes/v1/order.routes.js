// src/routes/v1/order.routes.ts
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { Order } from "../../models/Order.js";
const router = Router();
/** Zod schemas for request validation */
const ZOrderItem = z.object({
    _id: z.string().min(1),
    productId: z.string().optional(),
    quantity: z.coerce.number().int().min(1),
    title: z.string().optional(),
    price: z.coerce.number().min(0).optional(),
    image: z.string().optional(),
});
const ZCreateOrder = z.object({
    items: z.array(ZOrderItem).min(1),
    customer: z.object({
        name: z.string().min(1).optional(),
        phone: z.string().min(1),
        houseOrVillage: z.string().optional(),
        roadOrPostOffice: z.string().optional(),
        blockOrThana: z.string().optional(),
        district: z.string().optional(),
    }),
    totals: z
        .object({
        subTotal: z.number().min(0),
        shipping: z.number().min(0).optional().default(0),
        grandTotal: z.number().min(0),
    })
        .optional(),
    payment: z.any().optional(),
    notes: z.string().optional(),
    idempotencyKey: z.string().optional(),
});
/** Helper: human friendly error for Zod */
function zodErrorMessage(err) {
    try {
        return err.errors
            ? err.errors
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join(" | ")
            : String(err);
    }
    catch (e) {
        return String(err);
    }
}
/** POST /orders
 *  - validates request
 *  - checks idempotencyKey (header X-Idempotency-Key or body.idempotencyKey)
 *  - atomic stock decrement via findOneAndUpdate with $gte
 *  - recomputes totals server-side using product.price
 *  - creates order inside a mongoose transaction
 */
router.post("/orders", async (req, res) => {
    try {
        await dbConnect();
        const parse = ZCreateOrder.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                ok: false,
                message: "Invalid order payload",
                errors: zodErrorMessage(parse.error),
                code: "INVALID_PAYLOAD",
            });
        }
        const body = parse.data;
        const idempotencyKey = req.headers["x-idempotency-key"] ||
            body.idempotencyKey ||
            null;
        // Check idempotency: if existing order with same key, return it (idempotent)
        if (idempotencyKey) {
            const existing = await Order.findOne({ idempotencyKey }).lean();
            if (existing) {
                return res.status(200).json({
                    ok: true,
                    message: "Request already processed",
                    orderId: String(existing._id),
                });
            }
        }
        // Start transaction
        const session = await mongoose.connection.startSession();
        session.startTransaction();
        try {
            // Normalize items
            const normalized = body.items.map((it) => ({
                _id: String(it._id),
                qty: Math.max(1, Number(it.quantity || 1)),
            }));
            const updatedProducts = [];
            const orderLines = [];
            let subTotal = 0;
            for (const it of normalized) {
                // Attempt atomic decrement on stock or availableStock
                const updated = await Product.findOneAndUpdate({
                    _id: it._id,
                    $or: [
                        { stock: { $gte: it.qty } },
                        { availableStock: { $gte: it.qty } },
                    ],
                }, { $inc: { stock: -it.qty, availableStock: -it.qty } }, { new: true, session }).lean();
                if (!updated) {
                    // Fetch current product to provide meaningful error (without trusting client)
                    const current = await Product.findById(it._id)
                        .lean()
                        .session(session);
                    const available = current
                        ? current.stock ?? current.availableStock ?? 0
                        : 0;
                    await session.abortTransaction();
                    return res.status(409).json({
                        ok: false,
                        message: "Some items are out of stock",
                        outOfStock: [
                            {
                                _id: it._id,
                                requested: it.qty,
                                available,
                            },
                        ],
                        code: "OUT_OF_STOCK",
                    });
                }
                // Use product's DB price (do not trust client price)
                const unitPrice = Number(updated.price || 0);
                orderLines.push({
                    productId: new mongoose.Types.ObjectId(it._id),
                    qty: it.qty,
                    price: unitPrice,
                    title: updated.title || "",
                    image: updated.image || "",
                });
                subTotal += unitPrice * it.qty;
                updatedProducts.push({
                    _id: String(updated._id),
                    stock: updated.stock ?? updated.availableStock ?? 0,
                    name: updated.title || "Product",
                });
            }
            // Compute totals server-side; allow shipping if provided
            const computedTotals = {
                subTotal,
                shipping: Number(body.totals?.shipping || 0),
                grandTotal: Math.round(subTotal + Number(body.totals?.shipping || 0)),
            };
            // If client-provided totals exist and differ meaningfully, override (or optionally reject)
            if (body.totals &&
                Math.abs((body.totals.grandTotal || 0) - computedTotals.grandTotal) > 1) {
                // Log mismatch - do not trust client totals
                console.warn("Totals mismatch. Overriding client totals.");
            }
            const orderData = {
                idempotencyKey,
                customer: {
                    name: body.customer?.name || "Customer",
                    phone: body.customer.phone,
                    houseOrVillage: body.customer.houseOrVillage || "",
                    roadOrPostOffice: body.customer.roadOrPostOffice || "",
                    blockOrThana: body.customer.blockOrThana || "",
                    district: body.customer.district || "",
                },
                lines: orderLines,
                totals: computedTotals,
                status: "PENDING",
                payment: body.payment || {},
                notes: body.notes || "",
                meta: {
                    clientIp: req.ip,
                    userAgent: req.get("User-Agent") || "",
                },
            };
            // Create order inside transaction
            const created = await Order.create([orderData], { session });
            await session.commitTransaction();
            // Return 201 Created and Location header
            const orderId = String(created[0]._id);
            res.status(201).location(`/orders/${orderId}`).json({
                ok: true,
                message: "Order created successfully",
                orderId,
                updatedProducts,
                totals: computedTotals,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        catch (txErr) {
            console.error("Transaction error on /orders:", txErr);
            await session.abortTransaction();
            return res
                .status(500)
                .json({ ok: false, message: "Transaction failed", code: "TX_FAILED" });
        }
        finally {
            session.endSession();
        }
    }
    catch (err) {
        console.error("POST /orders error:", err);
        return res
            .status(500)
            .json({ ok: false, message: "Internal server error" });
    }
});
/** Generic GET /orders with search / pagination (admin) */
router.get("/orders", async (req, res) => {
    try {
        await dbConnect();
        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
        const status = typeof req.query.status === "string" ? req.query.status.trim() : null;
        const search = typeof req.query.search === "string" ? req.query.search.trim() : null;
        const filter = {};
        if (status)
            filter.status = status;
        if (search) {
            filter.$or = [
                { _id: { $regex: search, $options: "i" } },
                { "customer.name": { $regex: search, $options: "i" } },
                { "customer.phone": { $regex: search, $options: "i" } },
            ];
        }
        const items = await Order
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        const total = await Order.countDocuments(filter);
        const formatted = items.map((o) => ({
            ...o,
            _id: String(o._id),
            lines: Array.isArray(o.lines)
                ? o.lines.map((line) => ({
                    ...line,
                    productId: line.productId ? String(line.productId) : line.productId,
                }))
                : [],
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
/** GET single order by ID */
router.get("/orders/:id", async (req, res) => {
    try {
        await dbConnect();
        const { id } = req.params;
        if (!id)
            return res
                .status(400)
                .json({ ok: false, message: "Order ID is required" });
        const order = await Order.findById(id).lean();
        if (!order)
            return res
                .status(404)
                .json({
                ok: false,
                message: "Order not found",
                code: "ORDER_NOT_FOUND",
            });
        const formattedOrder = {
            ...order,
            _id: String(order._id),
            lines: Array.isArray(order.lines)
                ? order.lines.map((line) => ({
                    ...line,
                    productId: line.productId ? String(line.productId) : line.productId,
                }))
                : [],
            totals: order.totals || { subTotal: 0, shipping: 0, grandTotal: 0 },
        };
        return res.json({ ok: true, data: formattedOrder });
    }
    catch (err) {
        console.error("GET /orders/:id error:", err);
        return res.status(500).json({ ok: false, message: "Server error" });
    }
});
/** PATCH update order status */
router.patch("/orders/:id", async (req, res) => {
    try {
        await dbConnect();
        const { id } = req.params;
        const { status } = req.body;
        if (!id || !status) {
            return res
                .status(400)
                .json({
                ok: false,
                message: "Order ID and status are required",
                code: "MISSING_DATA",
            });
        }
        const validStatuses = [
            "PENDING",
            "IN_PROGRESS",
            "IN_SHIPPING",
            "DELIVERED",
            "CANCELLED",
        ];
        if (!validStatuses.includes(status)) {
            return res
                .status(400)
                .json({ ok: false, message: "Invalid status", code: "INVALID_STATUS" });
        }
        const updatedOrder = await Order
            .findByIdAndUpdate(id, { status }, { new: true, runValidators: true })
            .lean();
        if (!updatedOrder)
            return res
                .status(404)
                .json({
                ok: false,
                message: "Order not found",
                code: "ORDER_NOT_FOUND",
            });
        return res.json({
            ok: true,
            message: "Order status updated",
            data: { _id: String(updatedOrder._id), status: updatedOrder.status },
        });
    }
    catch (err) {
        console.error("PATCH /orders/:id error:", err);
        return res
            .status(500)
            .json({ ok: false, message: "Internal server error" });
    }
});
/** DELETE order (soft/hard depending on business) */
router.delete("/orders/:id", async (req, res) => {
    try {
        await dbConnect();
        const { id } = req.params;
        if (!id)
            return res
                .status(400)
                .json({
                ok: false,
                message: "Order ID is required",
                code: "MISSING_ID",
            });
        const deleted = await Order.findByIdAndDelete(id).lean();
        if (!deleted)
            return res
                .status(404)
                .json({
                ok: false,
                message: "Order not found",
                code: "ORDER_NOT_FOUND",
            });
        return res.json({
            ok: true,
            message: "Order deleted",
            data: { id: String(deleted._id) },
        });
    }
    catch (err) {
        console.error("DELETE /orders/:id error:", err);
        return res
            .status(500)
            .json({ ok: false, message: "Internal server error" });
    }
});
/** Debug route: recent orders (admin-only in prod) */
router.get("/debug/recent-orders", async (req, res) => {
    try {
        await dbConnect();
        const recent = await Order
            .find({})
            .select("_id customer.createdAt customer.phone customer.name createdAt status lines")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
        const formatted = recent.map((o) => ({
            _id: String(o._id),
            customerPhone: o.customer?.phone || null,
            customerName: o.customer?.name || null,
            createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
            status: o.status,
            linesCount: o.lines?.length || 0,
            ageHours: Math.round((Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60)) + " hours",
        }));
        const total = await Order.countDocuments({});
        return res.json({
            ok: true,
            data: formatted,
            message: `Found ${formatted.length} recent orders`,
            total,
        });
    }
    catch (err) {
        console.error("GET /debug/recent-orders error:", err);
        return res.status(500).json({ ok: false, message: "Debug failed" });
    }
});
export default router;
