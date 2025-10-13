import { Router, Request, Response, NextFunction } from "express";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { Order } from "../../models/Order.js";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAdmin } from "src/middlewares/auth.js";

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


// get all orders==========
router.get("/orders",requireAdmin, async (req, resolve, next) => {
  try {
    await dbConnect();

    const q = OrderlistQuery.parse(req.query);
    const filter: Record<string, unknown> = {};
    if(q.status) filter["status"] = q.status;

    const items = await Order.find(filter)
    .sort({createdAt: -1})
    .skip((q.page - 1) * q.limit)
    .limit(q.limit)
    .lean();

    const total =  await Order.countDocuments(filter);
    res.json({ok: true, data: {
      items: items.map(o => ({...o, _id: o._id.toString()}),
    total, page: q.page, limit: q.limit)
    }});
    
  } catch (err) {
    next(err)
  }
})


// get order by id========
router.get("/orders/:id", requireAdmin, async ( req, res, next) => {
  try {
    await dbConnect();

    const {id} = IdParam.parse(req.params);

    const order = await Order.findById(id).lean();

    if(!order) return res.status(404).json({ok: false, code: "NOT_FOUND"});
    res.json({ok: true, data: { ...order, _id: order._id.toString()}})
    
  } catch (err) {
    next(err)
    
  }
})



// Order create==========
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


// order patch========
const OrderUpdateDTO = z.object({
  status: z.enum(["PENDING", "IN_PROGESS", "IN_SHIPPING", "DELIVERED", "CANCELLED"])
});

router.patch("/orders/:id", requireAdmin, async ( req, resolve, next) => {

  try {
    await dbConnect();

    const {id} = Idparam.parse(req.params);
    const body = OrderUpdateDTO.parse(req.body);
    const order = await Order.findByIdAndUpdate(id, {status: body.status}, {new: true}).lean();
    if(!order) return res.status(404).json({ok: false, code: "NOT_FOUND"});
    
  } catch (err) {
    next(err)
    
  }
})


// order delete====
router.delete("/orders/:id",requireAdmin, async (req, res, next) => {
  try {
    await dbConnect();

    const {id} = IdParam.parse(req.params);
    const out = await Order.findById(id).lean();
    if(!out) return res.status(404).json({ok: false, code: "NOT_FOUND"});
    res.json({ok: true, data: {id}});
    
  } catch (err) {
    next(err)
    
  }
})

export default router;
