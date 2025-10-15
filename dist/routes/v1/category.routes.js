import { Router } from "express";
import { dbConnect } from "../../db/connection.js";
import { Category } from "../../models/Category.js";
const router = Router();
router.get("/categories", async (_req, res, next) => {
    try {
        await dbConnect();
        const items = await Category.find({ status: "ACTIVE" })
            .sort({ title: 1 })
            .lean();
        return res.json({
            ok: true,
            data: items.map((c) => ({ ...c, _id: c._id.toString() })),
        });
    }
    catch (e) {
        next(e);
    }
});
export default router;
