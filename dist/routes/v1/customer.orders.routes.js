// src/routes/v1/customer.orders.routes.ts
import { Router } from "express";
import { z } from "zod";
import { dbConnect } from "../../db/connection.js";
import { Order } from "../../models/Order.js";
const router = Router();
const OrderListQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    phone: z.string().optional(),
});
router.get("/customer/orders", async (req, res, next) => {
    try {
        await dbConnect();
        const q = OrderListQuery.parse(req.query);
        const filter = {};
        if (q.phone) {
            filter["customer.phone"] = q.phone;
        }
        else {
            return res.json({
                ok: true,
                data: {
                    items: [],
                    total: 0,
                    page: q.page,
                    limit: q.limit,
                    pages: 0,
                },
            });
        }
        console.log("🔍 Fetching orders for phone:", q.phone, "Filter:", filter);
        // Fix: Use proper typing for find()
        const items = await Order
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((q.page - 1) * q.limit)
            .limit(q.limit)
            .lean();
        const total = await Order.countDocuments(filter);
        const formattedItems = items.map((order) => ({
            ...order,
            _id: order._id.toString(),
            customer: order.customer || {},
            lines: Array.isArray(order.lines)
                ? order.lines.map((line) => ({
                    ...line,
                    productId: line.productId
                        ? line.productId.toString()
                        : line.productId,
                }))
                : [],
            totals: order.totals || { subTotal: 0, shipping: 0, grandTotal: 0 },
            status: order.status || "PENDING",
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        }));
        return res.json({
            ok: true,
            data: {
                items: formattedItems,
                total,
                page: q.page,
                limit: q.limit,
                pages: Math.ceil(total / q.limit),
            },
        });
    }
    catch (e) {
        console.error("❌ Customer orders error:", e);
        next(e);
    }
});
export default router;
