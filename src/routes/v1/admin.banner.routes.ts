// src/routes/v1/admin.banner.routes.ts
import { Router } from "express";
import { z, ZodError } from "zod";
import requireAdmin from "../../middlewares/auth.js";
import { Banner } from "../../models/banner.model.js";
import { dbConnect } from "../../db/connection.js";

const router = Router();

// helper: convert empty-string -> undefined for optional trimmed strings
const OptTrim = z.preprocess((v) => {
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? undefined : t;
  }
  return v;
}, z.string().min(1).optional());

const Body = z.object({
  image: z.string().url("image must be a valid URL"), // image required
  title: OptTrim, // optional
  subtitle: OptTrim, // optional
  discount: OptTrim, // optional
  status: z.enum(["ACTIVE", "HIDDEN"]).default("ACTIVE"),
  sort: z.coerce.number().int().min(0).default(100),
  position: z.enum(["hero", "side"]).default("hero"),
  link: z.string().optional(),
  categorySlug: z.string().optional().nullable(),
});

// GET /api/v1/admin/banners
router.get("/banners", requireAdmin, async (_req, res, next) => {
  try {
    await dbConnect();
    const list = await Banner.find()
      .sort({ sort: 1, createdAt: -1 })
      .lean()
      .exec();
    return res.json({
      ok: true,
      data: list.map((b: any) => ({ ...b, id: String(b._id) })),
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/admin/banners
router.post("/banners", requireAdmin, async (req, res, next) => {
  try {
    await dbConnect();
    const payload = Body.parse(req.body);
    const created = await Banner.create(payload);
    return res
      .status(201)
      .json({ ok: true, data: { id: String(created._id) } });
  } catch (e) {
    if (e instanceof ZodError) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_ERROR",
        issues: e.issues.map((i) => ({
          path: (i.path || []).join("."),
          message: i.message,
          code: i.code,
        })),
      });
    }
    next(e);
  }
});

// PATCH /api/v1/admin/banners/:id
router.patch("/banners/:id", requireAdmin, async (req, res, next) => {
  try {
    await dbConnect();
    const payload = Body.partial().parse(req.body);
    await Banner.findByIdAndUpdate(req.params.id, payload, {
      runValidators: true,
      new: true,
    }).exec();
    return res.json({ ok: true });
  } catch (e) {
    if (e instanceof ZodError) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_ERROR",
        issues: e.issues.map((i) => ({
          path: (i.path || []).join("."),
          message: i.message,
          code: i.code,
        })),
      });
    }
    next(e);
  }
});

// DELETE /api/v1/admin/banners/:id
router.delete("/banners/:id", requireAdmin, async (req, res, next) => {
  try {
    await dbConnect();
    await Banner.findByIdAndDelete(req.params.id).exec();
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
