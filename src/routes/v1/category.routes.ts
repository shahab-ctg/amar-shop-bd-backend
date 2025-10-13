import { NextFunction, Response, Request, Router } from "express";
import { dbConnect } from "src/db/connection.js";
import { Category } from "src/models/Category.js";


const router = Router();


router.get("/categories", async ( _req: Request, res: Response, next: NextFunction) => {


    try {
      await dbConnect();
      const items = await Category.find({ status: "ACTIVE" })
        .sort({ title: 1 })
        .lean();
      res.json({
        ok: true,
        data: items.map((c) => ({ ...c, _id: c._id.toString() })),
      });
    } catch (e) {
      next(e);
    }
});

export default router;