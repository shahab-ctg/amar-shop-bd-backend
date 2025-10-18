// Backend - src/routes/v1/category.routes.ts
import { Router } from "express";
import { Category } from "../../models/Category.js";
const router = Router();
// Public categories endpoint
router.get("/categories", async (req, res) => {
    try {
        const categories = await Category.find({ status: "ACTIVE" })
            .select("title slug image status")
            .sort({ title: 1 });
        res.json({
            ok: true,
            data: categories,
        });
    }
    catch (error) {
        console.error("Categories fetch error:", error);
        res.status(500).json({
            ok: false,
            message: "Failed to fetch categories",
        });
    }
});
// Get single category by slug
router.get("/categories/:slug", async (req, res) => {
    try {
        const category = await Category.findOne({
            slug: req.params.slug,
            status: "ACTIVE",
        });
        if (!category) {
            return res.status(404).json({
                ok: false,
                message: "Category not found",
            });
        }
        res.json({
            ok: true,
            data: category,
        });
    }
    catch (error) {
        console.error("Category fetch error:", error);
        res.status(500).json({
            ok: false,
            message: "Failed to fetch category",
        });
    }
});
export default router;
//# sourceMappingURL=category.routes.js.map