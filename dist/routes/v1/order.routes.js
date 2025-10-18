import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { Order } from "../../models/Order.js";
import { requireAdmin } from "../../middlewares/auth.js";
const router = Router();
const { Types } = mongoose;
const OrderCreateDTO = z.object({
    customer: z.object({
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().min(6),
        address: z.string().min(3),
        area: z.string().min(2),
    }),
    lines: z
        .array(z.object({
        productId: z.string(),
        qty: z.number().int().positive(),
    }))
        .min(1),
});
router.post("/orders", async (req, res, next) => {
    try {
        await dbConnect();
        const body = OrderCreateDTO.parse(req.body);
        const ids = body.lines.map((l) => l.productId);
        const products = await Product.find({
            _id: { $in: ids },
            status: "ACTIVE",
        }).lean();
        if (products.length !== body.lines.length) {
            return res.status(404).json({ ok: false, code: "PRODUCT_MISSING" });
        }
        let subTotal = 0;
        const lines = body.lines.map((l) => {
            const p = products.find((d) => d._id.toString() === l.productId);
            if ((p.stock ?? 0) < l.qty) {
                return res
                    .status(409)
                    .json({ ok: false, code: "OUT_OF_STOCK", productId: l.productId });
            }
            subTotal += p.price * l.qty;
            return {
                productId: p._id,
                title: p.title,
                image: p.image,
                price: p.price,
                qty: l.qty,
            };
        });
        const shipping = subTotal > 2000 ? 0 : 120;
        const grandTotal = subTotal + shipping;
        const order = await Order.create({
            customer: body.customer,
            lines,
            totals: { subTotal, shipping, grandTotal },
        });
        return res.status(201).json({
            ok: true,
            data: {
                id: order._id.toString(),
                totals: order.totals,
                status: order.status,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
const OrderListQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    status: z
        .enum(["PENDING", "IN_PROGRESS", "IN_SHIPPING", "DELIVERED", "CANCELLED"])
        .optional(),
});
router.get("/orders", requireAdmin, async (req, res, next) => {
    try {
        await dbConnect();
        const q = OrderListQuery.parse(req.query);
        const filter = {};
        if (q.status)
            filter.status = q.status;
        const items = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip((q.page - 1) * q.limit)
            .limit(q.limit)
            .lean();
        const total = await Order.countDocuments(filter);
        return res.json({
            ok: true,
            data: {
                items: items.map((o) => ({ ...o, _id: o._id.toString() })),
                total,
                page: q.page,
                limit: q.limit,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
const IdParam = z.object({
    id: z.string().refine(Types.ObjectId.isValid, "Invalid ObjectId"),
});
router.get("/orders/:id", requireAdmin, async (req, res, next) => {
    try {
        await dbConnect();
        const { id } = IdParam.parse(req.params);
        const order = await Order.findById(id).lean();
        if (!order)
            return res.status(404).json({ ok: false, code: "NOT_FOUND" });
        return res.json({
            ok: true,
            data: { ...order, _id: order._id.toString() },
        });
    }
    catch (e) {
        next(e);
    }
});
router.patch("/orders/:id", requireAdmin, async (req, res, next) => {
    try {
        await dbConnect();
        const { id } = IdParam.parse(req.params);
        const body = z
            .object({
            status: z.enum([
                "PENDING",
                "IN_PROGRESS",
                "IN_SHIPPING",
                "DELIVERED",
                "CANCELLED",
            ]),
        })
            .parse(req.body);
        const order = await Order.findByIdAndUpdate(id, { status: body.status }, { new: true }).lean();
        if (!order)
            return res.status(404).json({ ok: false, code: "NOT_FOUND" });
        return res.json({
            ok: true,
            data: { ...order, _id: order._id.toString() },
        });
    }
    catch (e) {
        next(e);
    }
});
router.delete("/orders/:id", requireAdmin, async (req, res, next) => {
    try {
        await dbConnect();
        const { id } = IdParam.parse(req.params);
        const out = await Order.findByIdAndDelete(id).lean();
        if (!out)
            return res.status(404).json({ ok: false, code: "NOT_FOUND" });
        return res.json({ ok: true, data: { id } });
    }
    catch (e) {
        next(e);
    }
});
export default router;
//# sourceMappingURL=order.routes.js.map