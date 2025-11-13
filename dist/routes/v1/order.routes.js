// src/routes/v1/order.routes.ts
import { Router } from "express";
import mongoose from "mongoose";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { Order } from "../../models/Order.js";
const router = Router();
router.post("/orders", async (req, res) => {
    console.log("📥 ORDER CREATION REQUEST RECEIVED:", {
        itemsCount: req.body.items?.length,
        customerPhone: req.body.customer?.phone,
        customerName: req.body.customer?.name,
        totals: req.body.totals,
    });
    try {
        await dbConnect();
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        if (!items.length) {
            return res
                .status(400)
                .json({ ok: false, message: "No items in order", code: "NO_ITEMS" });
        }
        const validationErrors = [];
        const normalized = items.map((it, index) => {
            const _id = it._id || it.productId;
            const quantity = Math.max(1, Number(it.quantity || 1));
            if (!_id)
                validationErrors.push(`Item ${index + 1}: Missing product ID`);
            if (quantity <= 0)
                validationErrors.push(`Item ${index + 1}: Invalid quantity`);
            return { _id: String(_id), quantity, originalData: it };
        });
        if (validationErrors.length) {
            return res.status(400).json({
                ok: false,
                message: "Invalid items data",
                errors: validationErrors,
                code: "INVALID_ITEMS",
            });
        }
        const session = await mongoose.connection.startSession();
        try {
            session.startTransaction();
            const updatedProducts = [];
            const outOfStockItems = [];
            for (const it of normalized) {
                const product = await Product.findById(it._id).session(session);
                if (!product) {
                    outOfStockItems.push({ _id: it._id, reason: "Product not found" });
                    continue;
                }
                const availableStock = product.stock ?? product.availableStock ?? 0;
                if (availableStock < it.quantity) {
                    outOfStockItems.push({
                        _id: it._id,
                        reason: "Insufficient stock",
                        available: availableStock,
                        requested: it.quantity,
                    });
                    continue;
                }
                const updated = await Product.findByIdAndUpdate(it._id, { $inc: { stock: -it.quantity, availableStock: -it.quantity } }, { new: true, session });
                if (updated) {
                    updatedProducts.push({
                        _id: String(updated._id),
                        stock: updated.stock ?? updated.availableStock ?? 0,
                        name: updated.title || "Unknown Product",
                    });
                }
            }
            if (outOfStockItems.length > 0) {
                await session.abortTransaction();
                return res.status(400).json({
                    ok: false,
                    message: "Some items are out of stock",
                    outOfStock: outOfStockItems,
                    code: "OUT_OF_STOCK",
                });
            }
            const orderData = {
                customer: {
                    name: req.body.customer?.name || "Customer",
                    phone: req.body.customer?.phone || "",
                    houseOrVillage: req.body.customer?.houseOrVillage || "",
                    roadOrPostOffice: req.body.customer?.roadOrPostOffice || "",
                    blockOrThana: req.body.customer?.blockOrThana || "",
                    district: req.body.customer?.district || "",
                },
                lines: normalized.map((item) => {
                    const o = item.originalData;
                    return {
                        productId: new mongoose.Types.ObjectId(item._id),
                        qty: item.quantity,
                        title: o?.title || "Product",
                        price: o?.price || 0,
                        image: o?.image || "",
                    };
                }),
                totals: req.body.totals || { subTotal: 0, shipping: 0, grandTotal: 0 },
                status: "PENDING",
                payment: req.body.payment || {},
                notes: req.body.notes || "",
            };
            // Fix: Use type assertion for create()
            const created = await Order.create([orderData], { session });
            await session.commitTransaction();
            return res.json({
                ok: true,
                message: "Order created successfully",
                orderId: created[0]._id,
                updatedProducts,
                timestamp: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error("❌ Transaction error:", err);
            await session.abortTransaction();
            return res
                .status(500)
                .json({ ok: false, message: "Transaction failed", error: String(err) });
        }
        finally {
            session.endSession();
        }
    }
    catch (err) {
        console.error("❌ Order endpoint error:", err);
        return res
            .status(500)
            .json({ ok: false, message: "Internal server error" });
    }
});
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
        // Fix: Use type assertion for find()
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
router.get("/customer/orders", async (req, res) => {
    try {
        await dbConnect();
        const phone = typeof req.query.phone === "string" ? req.query.phone.trim() : null;
        if (!phone)
            return res.status(400).json({ ok: false, message: "phone is required" });
        const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
        // Fix: Use type assertion for find()
        const items = await Order
            .find({ "customer.phone": phone })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        const formatted = items.map((o) => ({
            ...o,
            _id: String(o._id),
            lines: Array.isArray(o.lines)
                ? o.lines.map((line) => ({
                    ...line,
                    productId: line.productId ? String(line.productId) : line.productId,
                }))
                : [],
        }));
        return res.json({
            ok: true,
            data: { items: formatted, total: formatted.length, page: 1, limit },
        });
    }
    catch (err) {
        console.error("GET /customer/orders error:", err);
        return res.status(500).json({ ok: false, message: "Server error" });
    }
});
router.get("/debug/recent-orders", async (req, res) => {
    try {
        await dbConnect();
        // Fix: Use type assertion for find()
        const recentOrders = await Order
            .find({})
            .select("_id customer.createdAt customer.phone customer.name createdAt status lines")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
        const formatted = recentOrders.map((order) => ({
            _id: String(order._id),
            customerPhone: order.customer?.phone || null,
            customerName: order.customer?.name || null,
            createdAt: order.createdAt
                ? new Date(order.createdAt).toISOString()
                : null,
            status: order.status,
            linesCount: order.lines?.length || 0,
            ageHours: Math.round((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60)) + " hours",
        }));
        const total = await Order.countDocuments({});
        return res.json({
            ok: true,
            data: formatted,
            message: `Found ${formatted.length} recent orders`,
            total,
        });
    }
    catch (error) {
        console.error("Debug recent orders error:", error);
        return res.status(500).json({ ok: false, message: "Debug failed" });
    }
});
export default router;
