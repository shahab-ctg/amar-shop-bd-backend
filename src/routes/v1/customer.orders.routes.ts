import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "../../db/connection";
import { Order } from "../../models/Order";




const router = Router();

const OrderListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

// Get orders for logged-in customer
router.get("/customer/orders", async (req, res, next) => {
  try {
    await dbConnect();

    // In a real app, you'd get customer ID from auth token
    // For now, we'll use a query parameter or return all orders
    const q = OrderListQuery.parse(req.query);

    const items = await Order.find({})
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean();

    const total = await Order.countDocuments({});

    return res.json({
      ok: true,
      data: {
        items: items.map((order) => ({
          ...order,
          _id: order._id.toString(),
        })),
        total,
        page: q.page,
        limit: q.limit,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
