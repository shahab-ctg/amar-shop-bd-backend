// // routes/v1/banner.routes.ts
// import { Router } from "express";
// import { z } from "zod";
// import { dbConnect } from "../../db/connection.js";
// import { Banner } from "@/models/banner.model.js";
// const router = Router();
// const BannerQuery = z.object({
//   position: z.enum(["hero", "side"]).optional(),
//   status: z.enum(["ACTIVE", "HIDDEN"]).optional(),
//   limit: z.coerce.number().int().min(1).max(20).optional(), // ✅ NEW
// });
// router.get("/banners", async (req, res, next) => {
//   try {
//     await dbConnect();
//     const q = BannerQuery.parse(req.query);
//     const filter: Record<string, unknown> = {};
//     if (q.position) filter.position = q.position;
//     filter.status = q.status ?? "ACTIVE";
//     const items = await Banner.find(filter)
//       .select(
//         "image title subtitle discount status sort position createdAt updatedAt"
//       ) 
//       .sort({ sort: 1, createdAt: -1 })
//       .limit(q.limit ?? 6)
//       .lean()
//       .exec();
//     res.json({ ok: true, data: items });
//   } catch (e) {
//     next(e);
//   }
// });
// export default router;
// routes/public/banners.js
import { Router } from "express";
import { dbConnect } from "../../db/connection.js";
import { Banner } from "@/models/banner.model.js";
const router = Router();
// GET /api/v1/banners?position=hero&status=ACTIVE&limit=6&category=medicine
router.get("/banners", async (req, res) => {
    try {
        await dbConnect();
        const { position, status, limit, category } = req.query;
        const filter = {};
        if (position)
            filter.position = position;
        if (status)
            filter.status = status;
        if (category)
            filter.categorySlug = category;
        const lim = limit ? Math.min(Number(limit), 60) : 10;
        const docs = await Banner.find(filter)
            .sort({ sort: -1, createdAt: -1 })
            .limit(lim)
            .lean();
        const data = (docs || []).map((b) => ({
            _id: String(b._id),
            image: b.image,
            title: b.title,
            subtitle: b.subtitle,
            discount: b.discount,
            position: b.position,
            status: b.status,
            sort: b.sort,
            link: b.link,
            categorySlug: b.categorySlug,
        }));
        res.json({ ok: true, data });
    }
    catch (err) {
        console.error("Failed to fetch banners", err);
        res.status(500).json({ ok: false, message: "Failed to fetch banners" });
    }
});
export default router;
