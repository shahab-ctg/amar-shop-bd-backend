// routes/v1/order.routes.ts
import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { Order } from "../../models/Order.js";
const router = Router();
const OrderCreatedDTO = z.object({
    customer: z.object({
        name: z.string().min(2),
        phone: z.string().min(6),
        houseOrVillage: z.string().min(2),
        roadOrPostOffice: z.string().min(2),
        blockOrThana: z.string().min(2),
        district: z.string().min(2),
    }),
    lines: z
        .array(z.object({
        productId: z.string().min(1),
        qty: z.coerce.number().int().positive(),
    }))
        .min(1),
});
router.post("/orders", async (req, res, next) => {
    try {
        await dbConnect();
        const payload = OrderCreatedDTO.parse(req.body);
        const session = await Order.db.startSession();
        session.startTransaction();
        try {
            const orderLines = [];
            let subTotal = 0;
            for (const line of payload.lines) {
                if (!Types.ObjectId.isValid(line.productId)) {
                    throw {
                        status: 400,
                        message: `Invalid productId: ${line.productId}`,
                    };
                }
                const pid = new Types.ObjectId(line.productId);
                const qty = Number(line.qty);
                // Fetch product snapshot
                const product = await Product.findOne({ _id: pid })
                    .session(session)
                    .lean();
                if (!product) {
                    throw {
                        status: 404,
                        message: `Product not found: ${line.productId}`,
                    };
                }
                const available = Number(product.stock ?? 0);
                if (available < qty) {
                    throw {
                        status: 409,
                        message: `Insufficient stock for "${product.title}". Available: ${available}, requested: ${qty}`,
                        productId: line.productId,
                    };
                }
                // Atomic decrement
                const updateRes = await Product.updateOne({ _id: pid, stock: { $gte: qty } }, { $inc: { stock: -qty } }, { session });
                if (updateRes.modifiedCount === 0) {
                    throw {
                        status: 409,
                        message: `Failed to reserve stock for "${product.title}". Try again.`,
                        productId: line.productId,
                    };
                }
                const price = Number(product.price ?? 0);
                // ✅ FIX 1: Use images array instead of image property
                const productImage = Array.isArray(product.images) && product.images.length > 0
                    ? product.images[0]
                    : undefined;
                orderLines.push({
                    productId: pid,
                    title: product.title ?? "Product",
                    image: productImage, // ✅ FIXED: Use images array
                    price,
                    qty,
                });
                subTotal += price * qty;
            }
            const shipping = 0;
            const grandTotal = subTotal + shipping;
            const createdArr = await Order.create([
                {
                    customer: payload.customer,
                    lines: orderLines,
                    totals: { subTotal, shipping, grandTotal },
                    status: "PENDING",
                },
            ], { session });
            await session.commitTransaction();
            session.endSession();
            const orderDoc = createdArr[0].toObject();
            // ✅ FIX 2: Create new object instead of reassigning _id
            const responseOrder = {
                ...orderDoc,
                _id: orderDoc._id.toString(), // ✅ FIXED: Create new object
                lines: orderDoc.lines.map((line) => ({
                    ...line,
                    productId: line.productId.toString(),
                })),
            };
            return res.status(201).json({ ok: true, data: responseOrder });
        }
        catch (inner) {
            await session.abortTransaction();
            session.endSession();
            if (inner && inner.status)
                return res
                    .status(inner.status)
                    .json({ ok: false, message: inner.message });
            throw inner;
        }
    }
    catch (err) {
        next(err);
    }
});
router.get("/customer/orders", async (req, res, next) => {
    try {
        await dbConnect();
        const phone = typeof req.query.phone === "string" ? req.query.phone.trim() : null;
        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
        const filter = {};
        if (phone)
            filter["customer.phone"] = phone;
        const items = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        const total = await Order.countDocuments(filter);
        // ✅ FIXED: Create new objects instead of modifying original
        const formattedItems = items.map((order) => ({
            ...order,
            _id: order._id.toString(),
            lines: order.lines.map((line) => ({
                ...line,
                productId: line.productId.toString(),
            })),
        }));
        return res.json({
            ok: true,
            data: {
                items: formattedItems, // ✅ Use formatted items
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (e) {
        next(e);
    }
});
export default router;
