import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import requireAdmin from "../../middlewares/auth.js";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
const router = Router();
const { Types } = mongoose;
const SizeDTO = z
    .object({
    unit: z.enum(["ml", "g", "pcs"]),
    value: z.number().nonnegative(),
})
    .partial(); // optional pair
const VariantDTO = z.object({
    sku: z.string().min(1),
    shade: z.string().optional(),
    colorHex: z.string().optional(),
    size: SizeDTO.optional(),
    price: z.number().nonnegative().optional(),
    compareAtPrice: z.number().nonnegative().optional(),
    stock: z.number().int().nonnegative().optional(),
    image: z.string().url().optional(),
});
const AdminCreateProductDTO = z.object({
    title: z.string().min(2),
    slug: z.string().min(2),
    price: z.number().nonnegative(),
    stock: z.number().int().nonnegative().default(0),
    // media
    image: z.string().url().optional(), // single (legacy)
    images: z.array(z.string().url()).optional(), // ⭐ multi
    compareAtPrice: z.number().nonnegative().optional(),
    isDiscounted: z.boolean().optional().default(false),
    featured: z.boolean().optional().default(false),
    status: z.enum(["ACTIVE", "DRAFT", "HIDDEN"]).optional().default("ACTIVE"),
    categorySlug: z.string().optional(),
    brand: z.string().optional(),
    description: z.string().optional(),
    tagSlugs: z.array(z.string()).optional().default([]),
    // ⭐ Cosmetics attributes (all optional)
    shade: z.string().optional(),
    colorHex: z.string().optional(),
    size: SizeDTO.optional(),
    variants: z.array(VariantDTO).optional(),
    skinType: z.array(z.string()).optional(),
    hairType: z.array(z.string()).optional(),
    concerns: z.array(z.string()).optional(),
    ingredients: z.array(z.string()).optional(),
    allergens: z.array(z.string()).optional(),
    claims: z.array(z.string()).optional(),
    howToUse: z.string().optional(),
    caution: z.string().optional(),
    benefits: z.array(z.string()).optional(),
    gender: z.enum(["unisex", "female", "male"]).optional(),
    origin: z.string().optional(),
    expiry: z.coerce.date().optional(),
    batchNo: z.string().optional(),
});
const AdminUpdateProductDTO = AdminCreateProductDTO.partial().refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });
const IdParam = z.object({
    id: z.string().refine(Types.ObjectId.isValid, "Invalid ObjectId"),
});
router.post("/products", requireAdmin, async (req, res, next) => {
    try {
        await dbConnect();
        const body = AdminCreateProductDTO.parse(req.body);
        // normalize images
        const images = Array.isArray(body.images)
            ? body.images
            : body.image
                ? [body.image]
                : [];
        const created = await Product.create({
            ...body,
            images,
        });
        return res.status(201).json({
            ok: true,
            data: { id: created._id.toString(), slug: created.slug },
        });
    }
    catch (err) {
        const e = err;
        if (e?.name === "MongoServerError" && e.code === 11000) {
            return res
                .status(409)
                .json({ ok: false, code: "DUPLICATE_KEY", details: e.keyValue });
        }
        next(err);
    }
});
router.patch("/products/:id", requireAdmin, async (req, res, next) => {
    try {
        await dbConnect();
        const { id } = IdParam.parse(req.params);
        const body = AdminUpdateProductDTO.parse(req.body);
        // normalize images on update too
        const update = { ...body };
        if (Array.isArray(body.images)) {
            update.images = body.images;
        }
        else if (body.image) {
            update.images = [body.image];
        }
        const updated = await Product.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean();
        if (!updated)
            return res.status(404).json({ ok: false, code: "NOT_FOUND" });
        return res.json({
            ok: true,
            data: { ...updated, _id: updated._id.toString() },
        });
    }
    catch (err) {
        next(err);
    }
});
router.delete("/products/:id", requireAdmin, async (req, res, next) => {
    try {
        await dbConnect();
        const { id } = IdParam.parse(req.params);
        const out = await Product.findByIdAndDelete(id).lean();
        if (!out)
            return res.status(404).json({ ok: false, code: "NOT_FOUND" });
        return res.json({ ok: true, data: { id } });
    }
    catch (err) {
        next(err);
    }
});
export default router;
