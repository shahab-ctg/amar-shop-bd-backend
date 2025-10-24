import { Router } from "express";
import { Banner } from "@/models/banner.model.js";
const router = Router();
/**
 * GET /api/v1/banners
 * Public list – ACTIVE only, sorted by sort ASC then createdAt DESC
 * Response: { ok: true, data: Banner[] }
 */
router.get("/banners", async (_req, res, next) => {
    try {
        const list = await Banner.find({ status: "ACTIVE" })
            .sort({ sort: 1, createdAt: -1 })
            .lean()
            .exec();
        // normalize id field for frontend (string)
        const data = list.map((b) => ({
            id: String(b._id),
            image: b.image,
            title: b.title,
            subtitle: b.subtitle,
            discount: b.discount,
        }));
        return res.json({ ok: true, data });
    }
    catch (e) {
        next(e);
    }
});
export default router;
