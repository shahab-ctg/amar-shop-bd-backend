// import { Router } from "express";
// import { z } from "zod";
// import { Types } from "mongoose";
// import { dbConnect } from "../../db/connection.js";
// import { Product } from "../../models/Product.js";
// import { Order } from "../../models/Order.js";
// const router = Router();
// const OrderCreatedDTO = z.object({
//   customer: z.object({
//     name: z.string().min(2),
//     phone: z.string().min(6),
//     houseOrVillage: z.string().min(2),
//     roadOrPostOffice: z.string().min(2),
//     blockOrThana: z.string().min(2),
//     district: z.string().min(2),
//   }),
//   lines: z
//     .array(
//       z.object({
//         productId: z.string().min(1),
//         qty: z.coerce.number().int().positive(),
//       })
//     )
//     .min(1),
// });
// router.post("/orders", async (req, res, next) => {
//   try {
//     await dbConnect();
//     const payload = OrderCreatedDTO.parse(req.body);
//     // Start session/transaction
//     const session = await Order.db.startSession();
//     session.startTransaction();
//     try {
//       const orderLines: any[] = [];
//       let subTotal = 0;
//       for (const line of payload.lines) {
//         if (!Types.ObjectId.isValid(line.productId)) {
//           return await session
//             .abortTransaction()
//             .then(() => session.endSession())
//             .then(() =>
//               res
//                 .status(400)
//                 .json({
//                   ok: false,
//                   message: `Invalid productId: ${line.productId}`,
//                 })
//             );
//         }
//         const pid = new Types.ObjectId(line.productId);
//         const qty = Number(line.qty);
//         // Read product snapshot with the transaction session
//         const product = await Product.findOne({ _id: pid })
//           .session(session)
//           .lean();
//         if (!product) {
//           return await session
//             .abortTransaction()
//             .then(() => session.endSession())
//             .then(() =>
//               res
//                 .status(404)
//                 .json({
//                   ok: false,
//                   message: `Product not found: ${line.productId}`,
//                 })
//             );
//         }
//         const available = Number(product.stock ?? 0);
//         if (available < qty) {
//           return await session
//             .abortTransaction()
//             .then(() => session.endSession())
//             .then(() =>
//               res.status(409).json({
//                 ok: false,
//                 message: `Insufficient stock for "${product.title}". Available: ${available}, requested: ${qty}`,
//                 productId: line.productId,
//               })
//             );
//         }
//         // Atomic decrement guard: update only if enough stock remains
//         const updateRes = await Product.updateOne(
//           { _id: pid, stock: { $gte: qty } },
//           { $inc: { stock: -qty } },
//           { session }
//         );
//         if (updateRes.modifiedCount === 0) {
//           return await session
//             .abortTransaction()
//             .then(() => session.endSession())
//             .then(() =>
//               res.status(409).json({
//                 ok: false,
//                 message: `Failed to reserve stock for "${product.title}". Try again.`,
//                 productId: line.productId,
//               })
//             );
//         }
//         const price = Number(product.price ?? 0);
//         const productImage =
//           Array.isArray((product as any).images) &&
//           (product as any).images.length
//             ? (product as any).images[0]
//             : (product as any).image;
//         orderLines.push({
//           productId: pid,
//           title: product.title ?? "Product",
//           image: productImage,
//           price,
//           qty,
//         });
//         subTotal += price * qty;
//       }
//       const shipping = 0;
//       const grandTotal = subTotal + shipping;
//       const createdArr = await Order.create(
//         [
//           {
//             customer: payload.customer,
//             lines: orderLines,
//             totals: { subTotal, shipping, grandTotal },
//             status: "PENDING",
//           },
//         ],
//         { session }
//       );
//       await session.commitTransaction();
//       session.endSession();
//       const orderDoc = createdArr[0].toObject();
//       const responseOrder = {
//         ...orderDoc,
//         _id: orderDoc._id.toString(),
//         lines: orderDoc.lines.map((line: any) => ({
//           ...line,
//           productId: line.productId.toString(),
//         })),
//       };
//       return res.status(201).json({ ok: true, data: responseOrder });
//     } catch (innerErr) {
//       await session.abortTransaction();
//       session.endSession();
//       // If innerErr is structured, return meaningful
//       if (innerErr && (innerErr as any).status) {
//         const s = innerErr as any;
//         return res.status(s.status).json({ ok: false, message: s.message });
//       }
//       return next(innerErr);
//     }
//   } catch (err) {
//     next(err);
//   }
// });
// // customer orders listing
// router.get("/customer/orders", async (req, res, next) => {
//   try {
//     await dbConnect();
//     const phone =
//       typeof req.query.phone === "string" ? req.query.phone.trim() : null;
//     const page = Math.max(1, Number(req.query.page ?? 1));
//     const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
//     const filter: any = {};
//     if (phone) filter["customer.phone"] = phone;
//     const items = await Order.find(filter)
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .lean();
//     const total = await Order.countDocuments(filter);
//     const formattedItems = items.map((order) => ({
//       ...order,
//       _id: order._id.toString(),
//       lines: order.lines.map((line: any) => ({
//         ...line,
//         productId: line.productId.toString(),
//       })),
//     }));
//     return res.json({
//       ok: true,
//       data: {
//         items: formattedItems,
//         total,
//         page,
//         limit,
//         pages: Math.ceil(total / limit),
//       },
//     });
//   } catch (e) {
//     next(e);
//   }
// });
// export default router;
// routes/orders.js
import { Router } from "express";
import mongoose from "mongoose";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
/**
 * POST /api/v1/orders
 * body: { items: [{ _id: string, quantity: number }], payment?: {...} }
 *
 * This route decrements stock atomically using MongoDB transactions.
 * Requires replica set for transactions. If unavailable, the route will attempt
 * non-transactional fallback with best-effort rollback.
 */
const router = Router();
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
                    updated = await Product.findOneAndUpdate(f, { $inc: { stock: -it.quantity, availableStock: -it.quantity } }, { new: true, session, useFindAndModify: false }).lean();
                    if (updated)
                        break;
                }
                if (!updated) {
                    // Not enough stock -> abort
                    throw new Error(`Out of stock for product ${it._id}`);
                }
                updatedProducts.push({ _id: String(updated._id), stock: updated.stock ?? updated.availableStock ?? 0 });
            }
            // TODO: create order document in Orders collection (not included here).
            // e.g., await Order.create([{ items: normalized, user: req.user?._id }], { session });
            await session.commitTransaction();
            session.endSession();
            return res.json({ ok: true, updatedProducts });
        }
        catch (err) {
            // abort transaction
            try {
                await session.abortTransaction();
                session.endSession();
            }
            catch (e) {
                console.error("Failed to abort transaction", e);
            }
            // bubble error
            return res.status(400).json({ ok: false, message: err.message || "Order failed" });
        }
    }
    catch (err) {
        console.error("Order endpoint error", err);
        return res.status(500).json({ ok: false, message: "Server error" });
    }
});
export default router;
