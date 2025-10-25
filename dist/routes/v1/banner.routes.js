// src/routes/v1/banner.routes.ts
import { Router } from "express";
import { z } from "zod";
import { dbConnect } from "../../db/connection";
import { Banner } from "../../models/banner.model";
const router = Router();
const BannerQuery = z.object({
    position: z.enum(["hero", "side"]).optional(),
    status: z.enum(["ACTIVE", "HIDDEN"]).optional(),
});
router.get("/banners", async (req, res, next) => {
    try {
        await dbConnect();
        const q = BannerQuery.parse(req.query);
        const filter = {};
        if (q.position)
            filter.position = q.position;
        // default show ACTIVE banners only
        filter.status = q.status ?? "ACTIVE";
        const items = await Banner.find(filter)
            .sort({ sort: 1, createdAt: -1 })
            .lean()
            .exec();
        res.json({ ok: true, data: items });
    }
    catch (e) {
        next(e);
    }
});
export default router;
