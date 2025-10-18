import { Router } from "express";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { z } from "zod";
import { validateQuery } from "../../middlewares/validate.js";
const router = Router();
const ProductListQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(60).default(12),
    category: z.string().optional(),
    tag: z.string().optional(),
    q: z.string().optional(),
    discounted: z.enum(["true", "false"]).optional(),
});
// GET /api/v1/products
router.get("/products", validateQuery(ProductListQuery), async (req, res, next) => {
    try {
        await dbConnect();
        const q = res.locals.query;
        const filter = { status: "ACTIVE" };
        if (q.category)
            filter.categorySlug = q.category;
        if (q.tag)
            filter.tagSlugs = q.tag;
        if (q.discounted === "true")
            filter.isDiscounted = true;
        if (q.q)
            filter.title = { $regex: q.q, $options: "i" };
        const page = q.page;
        const limit = q.limit;
        const items = await Product.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .exec();
        const total = await Product.countDocuments(filter).exec();
        res.json({
            ok: true,
            data: {
                items: items.map((p) => ({ ...p, _id: p._id.toString() })),
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/products/:slug
router.get("/products/:slug", async (req, res, next) => {
    try {
        await dbConnect();
        const item = await Product.findOne({
            slug: req.params.slug,
            status: "ACTIVE",
        })
            .lean()
            .exec();
        if (!item)
            return res.status(404).json({ ok: false, code: "NOT_FOUND" });
        res.json({ ok: true, data: { ...item, _id: item._id.toString() } });
    }
    catch (error) {
        next(error);
    }
});
// test purpose====
router.get("/dev/seed", async (_req, res, next) => {
    try {
        await dbConnect();
        const count = await Product.countDocuments();
        if (count === 0) {
            await Product.insertMany([
                {
                    title: "Fresh Milk 1L",
                    slug: "fresh-milk-1l",
                    price: 120,
                    isDiscounted: true,
                    stock: 30,
                    status: "ACTIVE",
                },
                {
                    title: "Yogurt 500g",
                    slug: "yogurt-500g",
                    price: 180,
                    stock: 12,
                    status: "ACTIVE",
                },
                {
                    title: "Cheese 200g",
                    slug: "cheese-200g",
                    price: 240,
                    stock: 8,
                    status: "ACTIVE",
                },
            ]);
        }
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
export default router;
//# sourceMappingURL=product.routes.js.map