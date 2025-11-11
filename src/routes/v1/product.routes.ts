// src/routes/v1/product.routes.ts
import { Router, Request, Response, NextFunction } from "express";
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
  sort: z.string().optional(),
});

// escape regex util to avoid special char issues (and ReDoS risks)
function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get(
  "/products",
  validateQuery(ProductListQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await dbConnect();

      const q = res.locals.query as z.infer<typeof ProductListQuery>;

      const filter: Record<string, any> = { status: "ACTIVE" };

      if (q.category) filter.categorySlug = q.category;

      if (q.tag) {
        if (q.tag !== "trending") {
          filter.tagSlugs = { $in: [q.tag] };
        }
      }

      if (q.discounted === "true") filter.isDiscounted = true;

      if (q.q) {
        const safe = escapeRegex(q.q);
        filter.title = { $regex: safe, $options: "i" };
      }

      const page = Math.max(1, Number(q.page || 1));
      const limit = Math.max(1, Math.min(Number(q.limit || 12), 60));

      let sort: Record<string, 1 | -1> | any = { createdAt: -1 };

      if (q.tag === "trending") {
        sort = { salesCount: -1, views: -1, createdAt: -1 } as any;
      } else if (q.sort === "price_asc") {
        sort = { price: 1 } as any;
      } else if (q.sort === "price_desc") {
        sort = { price: -1 } as any;
      }

      const projection =
        "_id title slug image images price compareAtPrice stock availableStock categorySlug status createdAt";

      // Run items query and count concurrently to reduce latency
      const [items, total] = await Promise.all([
        Product.find(filter)
          .select(projection)
          .sort(sort as any)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()
          .exec(),
        Product.countDocuments(filter).exec(),
      ]);

      // small public cache hint (optional, tune as needed)
      res.set("Cache-Control", "public, max-age=30, s-maxage=30");

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
