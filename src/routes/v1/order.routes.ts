import { Router, Request, Response, NextFunction } from "express";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { Order } from "../../models/Order.js";
import { z } from "zod";
import { Types } from "mongoose";

const router = Router();

const OrderCreateDTO = z.object({
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(6),
    address: z.string().min(3),
    area: z.string().min(2),
  }),
  lines: z
    .array(
      z.object({
        productId: z.string(),
        qty: z.number().int().positive(),
      })
    )
    .min(1),
});

type TLeanProduct = {
  _id: Types.ObjectId;
  title: string;
  price: number;
  image?: string;
  stock?: number;
  status?: string;
};

router.post(
  "/orders",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await dbConnect();
      const body = OrderCreateDTO.parse(req.body); 
      const ids = body.lines.map((l) => l.productId);
      const products = await Product.find({
        _id: { $in: ids },
        status: "ACTIVE",
      })
        .lean<TLeanProduct[]>()
        .exec();

      if (products.length !== body.lines.length) {
        return res.status(404).json({ ok: false, code: "PRODUCT_MISSING" });
      }

      let subTotal = 0;
      const lines = body.lines.map((l) => {
        const p = products.find((d) => d._id.toString() === l.productId)!;
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

      res.status(201).json({
        ok: true,
        data: {
          id: order._id.toString(),
          totals: order.totals,
          status: order.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
