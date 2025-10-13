import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "../../db/connection.js";
import { requireAdmin } from "../../middlewares/auth.js";
import { Category } from "../../models/Category.js";

const router = Router();
const { Types } = mongoose;

const CreateDTO = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  image: z.string().optional(),
  status: z.enum(["ACTIVE", "HIDDEN"]).optional().default("ACTIVE"),
});

const UpdateDTO = CreateDTO.partial().refine((d) => Object.keys(d).length > 0, {
  message: "At least one field required",
});

const IdParam = z.object({
  id: z.string().refine(Types.ObjectId.isValid, "Invalid ObjectId"),
});

type LeanCategory = {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  image?: string;
  status: "ACTIVE" | "HIDDEN";
};

router.post("/admin/categories", requireAdmin, async (req, res, next) => {
  try {
    await dbConnect();
    const body = CreateDTO.parse(req.body);
    const created = await Category.create(body);
    return res
      .status(201)
      .json({
        ok: true,
        data: { id: created._id.toString(), slug: created.slug },
      });
  } catch (err) {
    next(err);
  }
});

router.patch("/admin/categories/:id", requireAdmin, async (req, res, next) => {
  try {
    await dbConnect();
    const { id } = IdParam.parse(req.params);
    const body = UpdateDTO.parse(req.body);
    const updated = await Category.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean<LeanCategory | null>();
    if (!updated) return res.status(404).json({ ok: false, code: "NOT_FOUND" });
    return res.json({
      ok: true,
      data: { ...updated, _id: updated._id.toString() },
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/admin/categories/:id", requireAdmin, async (req, res, next) => {
  try {
    await dbConnect();
    const { id } = IdParam.parse(req.params);
    const out = await Category.findByIdAndDelete(
      id
    ).lean<LeanCategory | null>();
    if (!out) return res.status(404).json({ ok: false, code: "NOT_FOUND" });
    return res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export default router;
