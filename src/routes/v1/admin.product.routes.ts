import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "../../db/connection.js";
import { requireAdmin } from "../../middlewares/auth.js";
import { Product, type ProductDoc } from "../../models/Product.js";

const router = Router();
const { Types } = mongoose;

const AdminCreateProductDTO = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
  image: z.string().optional(),
  compareAtPrice: z.number().nonnegative().optional(),
  isDiscounted: z.boolean().optional().default(false),
  status: z.enum(["ACTIVE", "DRAFT", "HIDDEN"]).optional().default("ACTIVE"),
  categorySlug: z.string().optional(),
  tagSlugs: z.array(z.string()).optional().default([]),
});

const AdminUpdateProductDTO = AdminCreateProductDTO.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: "At least one field required" }
);

const IdParam = z.object({
  id: z.string().refine(Types.ObjectId.isValid, "Invalid ObjectId"),
});

router.post("/products", requireAdmin, async (req, res, next) => {
  try {
    await dbConnect();
    const body = AdminCreateProductDTO.parse(req.body);
    const created: ProductDoc = await Product.create(body);
    return res
      .status(201)
      .json({
        ok: true,
        data: { id: created._id.toString(), slug: created.slug },
      });
  } catch (err: unknown) {
   
    const e = err as {
      name?: string;
      code?: number;
      keyValue?: Record<string, unknown>;
    };
    if (e?.name === "MongoServerError" && e.code === 11000) {
      return res
        .status(409)
        .json({ ok: false, code: "DUPLICATE_KEY", details: e.keyValue });
    }
    next(err);
  }
});

type LeanProduct = {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  image?: string;
  price: number;
  compareAtPrice?: number;
  isDiscounted?: boolean;
  stock?: number;
  categorySlug?: string;
  tagSlugs?: string[];
  status: "ACTIVE" | "DRAFT" | "HIDDEN";
};

router.patch("/products/:id", requireAdmin, async (req, res, next) => {
  try {
    await dbConnect();
    const { id } = IdParam.parse(req.params);
    const body = AdminUpdateProductDTO.parse(req.body);
    const updated = await Product.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean<LeanProduct | null>();
    if (!updated) return res.status(404).json({ ok: false, code: "NOT_FOUND" });
    return res.json({
      ok: true,
      data: { ...updated, _id: updated._id.toString() },
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/products/:id", requireAdmin, async (req, res, next) => {
  try {
    await dbConnect();
    const { id } = IdParam.parse(req.params);
    const out = await Product.findByIdAndDelete(id).lean<LeanProduct | null>();
    if (!out) return res.status(404).json({ ok: false, code: "NOT_FOUND" });
    return res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export default router;
