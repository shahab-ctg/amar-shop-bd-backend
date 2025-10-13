import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { dbConnect } from "../../db/connection.js";
import { Category } from "../../models/Category.js";

const router = Router();

type LeanCategory = {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  image?: string;
  status: "ACTIVE" | "HIDDEN";
};

router.get(
  "/categories",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await dbConnect();
      const items = await Category.find({ status: "ACTIVE" })
        .sort({ title: 1 })
        .lean<LeanCategory[]>();

      return res.json({
        ok: true,
        data: items.map((c) => ({ ...c, _id: c._id.toString() })),
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
