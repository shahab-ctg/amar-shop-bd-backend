// import { Router, Request, Response, NextFunction } from "express";
// import { dbConnect } from "../../db/connection.js";
// import { Product } from "../../models/Product.js";
// import { z } from "zod";
// import { Types } from "mongoose";
// import { validateQuery } from "../../middlewares/validate.js";

// const router = Router();

// const ProductListQuery = z.object({
//   page: z.coerce.number().int().positive().default(1),
//   limit: z.coerce.number().int().positive().max(60).default(12),
//   category: z.string().optional(),
//   tag: z.string().optional(),
//   q: z.string().optional(),
//   discounted: z.enum(["true", "false"]).optional(),
// });

// type TLeanProduct = {
//   _id: Types.ObjectId;
//   title: string;
//   slug: string;
//   image?: string;
//   price: number;
//   isDiscounted?: boolean;
//   stock?: number;
//   status?: string;
//   categorySlug?: string;
//   tagSlugs?: string[];
//   createdAt?: Date;
//   // optional fields that may be used for trending ranking
//   salesCount?: number;
//   views?: number;
// };

// router.get(
//   "/products",
//   validateQuery(ProductListQuery),
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       await dbConnect();
//       const q = res.locals.query as z.infer<typeof ProductListQuery>;

//       // base filter: only active products
//       const filter: any = { status: "ACTIVE" };

//       // category filter (by slug)
//       if (q.category) filter.categorySlug = q.category;

//       // tag filter: use $in so that tagSlugs array matching works robustly
//       if (q.tag) {
//         // special handling for "trending" — handled below as sort override,
//         // but still keep tag filter if someone sends e.g. tag=snacks
//         if (q.tag !== "trending") {
//           filter.tagSlugs = { $in: [q.tag] };
//         }
//       }

//       // discounted filter
//       if (q.discounted === "true") filter.isDiscounted = true;

//       // simple text search
//       if (q.q) filter.title = { $regex: q.q, $options: "i" };

//       // Pagination
//       const page = Math.max(1, Number(q.page || 1));
//       const limit = Math.max(1, Math.min(Number(q.limit || 12), 60));

//       // Sorting: default newest first
//       let sort: Record<string, -1 | 1> = { createdAt: -1 };

//       // If client asked for tag=trending, use trending sort preference:
//       // Prefer salesCount (if present), then views, then fallback to createdAt.
//       if (q.tag === "trending") {
//         // NOTE: make sure your Product schema contains salesCount or views fields.
//         // If not present, this will just sort by createdAt fallback.
//         sort = { salesCount: -1, views: -1, createdAt: -1 } as any;
//       }

//       // Execute query
//       const query = Product.find(filter)
//         .sort(sort)
//         .skip((page - 1) * limit)
//         .limit(limit)
//         .lean<TLeanProduct[]>();

//       const items = await query.exec();

//       // total count for the filter (for pagination)
//       const total = await Product.countDocuments(filter).exec();

//       // Return consistent response shape. Your frontend's fetchProducts should
//       // read data.items (array) — see guidance below.
//       res.json({
//         ok: true,
//         data: {
//           items: items.map((p) => ({ ...p, _id: p._id.toString() })),
//           total,
//           page,
//           limit,
//           pages: Math.ceil(total / limit),
//         },
//       });
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // GET /api/v1/products/:slug (unchanged except ensures consistent shape)
// router.get(
//   "/products/:slug",
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       await dbConnect();
//       const item = await Product.findOne({
//         slug: req.params.slug,
//         status: "ACTIVE",
//       })
//         .lean<TLeanProduct | null>()
//         .exec();

//       if (!item) return res.status(404).json({ ok: false, code: "NOT_FOUND" });

//       res.json({ ok: true, data: { ...item, _id: item._id.toString() } });
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// // test seed (unchanged)
// router.get("/dev/seed", async (_req, res, next) => {
//   try {
//     await dbConnect();
//     const count = await Product.countDocuments();
//     if (count === 0) {
//       await Product.insertMany([
//         {
//           title: "Fresh Milk 1L",
//           slug: "fresh-milk-1l",
//           price: 120,
//           isDiscounted: true,
//           stock: 30,
//           status: "ACTIVE",
//           salesCount: 50,
//           views: 1200,
//         },
//         {
//           title: "Yogurt 500g",
//           slug: "yogurt-500g",
//           price: 180,
//           stock: 12,
//           status: "ACTIVE",
//           salesCount: 30,
//           views: 800,
//         },
//         {
//           title: "Cheese 200g",
//           slug: "cheese-200g",
//           price: 240,
//           stock: 8,
//           status: "ACTIVE",
//           salesCount: 20,
//           views: 600,
//         },
//       ]);
//     }
//     res.json({ ok: true });
//   } catch (e) {
//     next(e);
//   }
// });

// export default router;


// routes/products.ts
import { Router, Request, Response, NextFunction } from "express";
import { dbConnect } from "../../db/connection.js";
import { Product } from "../../models/Product.js";
import { z } from "zod";
import { Types } from "mongoose";
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

type TLeanProduct = {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  image?: string;
  price: number;
  isDiscounted?: boolean;
  stock?: number;
  status?: string;
  categorySlug?: string;
  tagSlugs?: string[];
  createdAt?: Date;
  salesCount?: number;
  views?: number;
};

router.get(
  "/products",
  validateQuery(ProductListQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await dbConnect();
      const q = res.locals.query as z.infer<typeof ProductListQuery>;

      const filter: any = { status: "ACTIVE" };
      if (q.category) filter.categorySlug = q.category;
      if (q.discounted === "true") filter.isDiscounted = true;
      if (q.q) filter.title = { $regex: q.q, $options: "i" };

      // tag filter — use $in to match arrays like tagSlugs
      if (q.tag && q.tag !== "trending") {
        filter.tagSlugs = { $in: [q.tag] };
      }

      const page = Math.max(1, Number(q.page || 1));
      const limit = Math.max(1, Math.min(Number(q.limit || 12), 60));

      // Default sort: newest first
      let sort: Record<string, -1 | 1> = { createdAt: -1 };

      // If tag=trending -> apply trending sorting (salesCount, views, createdAt)
      if (q.tag === "trending") {
        // This will sort by salesCount desc first, then views then createdAt
        // If your Product docs don't have these fields it's harmless: they will be considered missing and fallback to createdAt.
        sort = { salesCount: -1, views: -1, createdAt: -1 } as any;
      }

      const items = await Product.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<TLeanProduct[]>()
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
    } catch (error) {
      next(error);
    }
  }
);

// product detail unchanged
router.get("/products/:slug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await dbConnect();
    const item = await Product.findOne({ slug: req.params.slug, status: "ACTIVE" })
      .lean<TLeanProduct | null>()
      .exec();
    if (!item) return res.status(404).json({ ok: false, code: "NOT_FOUND" });
    res.json({ ok: true, data: { ...item, _id: item._id.toString() } });
  } catch (error) {
    next(error);
  }
});

export default router;
