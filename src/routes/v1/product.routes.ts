// src/routes/v1/product.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { z } from "zod";
import { validateQuery } from "../../middlewares/validate.js";

const router = Router();

/**
 * Query validation schema (Zod)
 */
const ProductListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(60).default(12),
  category: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
  discounted: z.enum(["true", "false"]).optional(),
  sort: z.string().optional(), // e.g. price_asc, price_desc
});

/**
 * GET /api/v1/products
 * Public product listing with filters, pagination and sort.
 */
router.get(
  "/products",
  validateQuery(ProductListQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await dbConnect();

      // res.locals.query populated by validateQuery middleware
      const q = res.locals.query as z.infer<typeof ProductListQuery>;

      // base: only active products
      const filter: Record<string, any> = { status: "ACTIVE" };

      // category (by slug)
      if (q.category) filter.categorySlug = q.category;

      // tag filter
      if (q.tag) {
        if (q.tag !== "trending") {
          filter.tagSlugs = { $in: [q.tag] };
        }
      }

      // discounted filter
      if (q.discounted === "true") filter.isDiscounted = true;

      // simple title text search
      if (q.q) filter.title = { $regex: q.q, $options: "i" };

      // pagination
      const page = Math.max(1, Number(q.page || 1));
      const limit = Math.max(1, Math.min(Number(q.limit || 12), 60));

      // permissive sort type to satisfy TS (Mongo accepts numeric 1/-1)
      let sort: Record<string, 1 | -1> | any = { createdAt: -1 };

      if (q.tag === "trending") {
        // trending: salesCount desc, views desc, fallback createdAt desc
        sort = { salesCount: -1, views: -1, createdAt: -1 } as any;
      } else if (q.sort === "price_asc") {
        sort = { price: 1 } as any;
      } else if (q.sort === "price_desc") {
        sort = { price: -1 } as any;
      }

      // select projection (choose fields you want to return)
      const projection =
        "_id title slug image images price compareAtPrice stock availableStock categorySlug status";

      const items = await Product.find(filter)
        .select(projection)
        .sort(sort as any) // cast to any so TS won't complain, runtime is fine
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec();

      const total = await Product.countDocuments(filter).exec();

      res.json({
        ok: true,
        data: {
          items: items.map((p) => ({ ...p, _id: String((p as any)._id) })),
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/products/:slug
 * Get single product by slug
 */
router.get(
  "/products/:slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await dbConnect();
      const item = await Product.findOne({
        slug: req.params.slug,
        status: "ACTIVE",
      })
        .lean()
        .exec();

      if (!item) return res.status(404).json({ ok: false, code: "NOT_FOUND" });

      res.json({ ok: true, data: { ...item, _id: String((item as any)._id) } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
