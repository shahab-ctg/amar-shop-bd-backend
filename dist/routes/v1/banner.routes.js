// routes/v1/banner.routes.ts
import { Router } from "express";
import { z } from "zod";
import { dbConnect } from "../../db/connection.js";
import { Banner } from "../../models/banner.model.js";
const router = Router();
const BannerQuery = z.object({
    position: z.enum(["hero", "side"]).optional(),
    status: z.enum(["ACTIVE", "HIDDEN"]).optional(),
    limit: z.coerce.number().int().min(1).max(20).optional(), // ✅ NEW
});
router.get("/banners", async (req, res, next) => {
    try {
        await dbConnect();
        const q = BannerQuery.parse(req.query);
        const filter = {};
        if (q.position)
            filter.position = q.position;
        filter.status = q.status ?? "ACTIVE";
        const items = await Banner.find(filter)
            .select("image title subtitle discount status sort position createdAt updatedAt")
            .sort({ sort: 1, createdAt: -1 })
            .limit(q.limit ?? 6)
            .lean()
            .exec();
        res.json({ ok: true, data: items });
    }
    catch (e) {
        next(e);
    }
});
export default router;
