import { Router } from "express";
import { z } from "zod";
import { Banner } from "@/models/banner.model.js";
import { requireAdmin } from "@/middlewares/auth.js";
const router = Router();
const CreateDTO = z.object({
    image: z.string().url("image must be a valid URL"),
    title: z.string().min(1),
    subtitle: z.string().min(1),
    discount: z.string().optional(),
    status: z.enum(["ACTIVE", "HIDDEN"]).optional(),
    sort: z.number().int().min(0).optional(),
});
const UpdateDTO = CreateDTO.partial();
/**
 * GET /api/v1/admin/banners
 */
router.get("/banners", requireAdmin, async (_req, res, next) => {
    try {
        const list = await Banner.find().sort({ sort: 1, createdAt: -1 }).lean();
        return res.json({
            ok: true,
            data: list.map((b) => ({ ...b, id: String(b._id) })),
        });
    }
    catch (e) {
        next(e);
    }
});
/**
 * POST /api/v1/admin/banners
 */
router.post("/banners", requireAdmin, async (req, res, next) => {
    try {
        const payload = CreateDTO.parse(req.body);
        const created = await Banner.create(payload);
        return res
            .status(201)
            .json({ ok: true, data: { id: String(created._id) } });
    }
    catch (e) {
        next(e);
    }
});
/**
 * PATCH /api/v1/admin/banners/:id
 */
router.patch("/banners/:id", requireAdmin, async (req, res, next) => {
    try {
        const id = req.params.id;
        const payload = UpdateDTO.parse(req.body);
        await Banner.findByIdAndUpdate(id, payload, { runValidators: true });
        return res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
/**
 * DELETE /api/v1/admin/banners/:id
 */
router.delete("/banners/:id", requireAdmin, async (req, res, next) => {
    try {
        const id = req.params.id;
        await Banner.findByIdAndDelete(id);
        return res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
export default router;
