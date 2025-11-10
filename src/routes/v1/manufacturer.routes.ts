
import { dbConnect } from "../../db/connection.js";
import { ManufacturerBanner } from "../../models/ManufacturerBanner.js";
import express from "express";
import { z } from "zod";

const router = express.Router();

/** Create banner (admin) */
router.post("/", async (req, res, next) => {
  try {
    const schema = z.object({
      manufacturerId: z.string().min(1),
      image: z.string().min(1),
      link: z.string().optional(),
      active: z.boolean().optional(),
      order: z.number().optional(),
    });
    const body = schema.parse(req.body);

    const banner = await ManufacturerBanner.create({
      manufacturer: body.manufacturerId,
      image: body.image,
      link: body.link,
      active: body.active ?? true,
      order: body.order ?? 0,
    });

    return res.status(201).json(banner);
  } catch (err) {
    next(err);
  }
});

/** list banners */
router.get("/", async (req, res, next) => {
  await dbConnect()
  try {
    const banners = await ManufacturerBanner.find({ active: true })
      .sort({ order: 1 })
      .populate("manufacturer")
      .lean();
    return res.json(banners);
  } catch (err) {
    next(err);
  }
});

export default router;
