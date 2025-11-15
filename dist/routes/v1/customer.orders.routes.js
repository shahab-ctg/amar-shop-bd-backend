// src/routes/v1/customer.orders.routes.ts
import { Router } from "express";
import { z } from "zod";
import { dbConnect } from "../../db/connection.js";
import { Order } from "../../models/Order.js";
const router = Router();
const OrderListQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(50),
    phone: z.string().min(1).optional(),
});
router.get("/customer/orders", async (req, res) => {
    try {
        await dbConnect();
        const parsed = OrderListQuery.safeParse(req.query);
        if (!parsed.success) {
            return res
                .status(400)
                .json({
                ok: false,
                message: "Invalid query",
                errors: parsed.error.format(),
            });
        }
        const q = parsed.data;
        if (!q.phone) {
            return res.json({
                ok: true,
                data: { items: [], total: 0, page: q.page, limit: q.limit, pages: 0 },
            });
        }
        const filter = { "customer.phone": q.phone };
        const items = await Order
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((q.page - 1) * q.limit)
            .limit(q.limit)
            .lean();
        const total = await Order.countDocuments(filter);
        const formattedItems = items.map((order) => ({
            ...order,
            _id: String(order._id),
            customer: order.customer || {},
            lines: Array.isArray(order.lines)
                ? order.lines.map((line) => ({
                    ...line,
                    productId: line.productId ? String(line.productId) : line.productId,
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
        console.error("GET /customer/orders error:", e);
        return res.status(500).json({ ok: false, message: "Server error" });
    }
});
export default router;
