import { Router } from "express";
import { Category } from "@/models/Category.js";

const router = Router();

/**
 * Public categories endpoint
 * - Always returns `title` (coalesced from title || name)
 * - Keeps existing shape: { ok: true, data: [...] }
 */
router.get("/categories", async (_req, res) => {
  try {
    // we select both name and title to be safe
    const docs = await Category.find({ status: "ACTIVE" })
      .select("_id title name slug image description status")
      .sort({ title: 1, name: 1 })
      .lean();

    const categories = (docs || []).map((c: any) => ({
      _id: String(c._id),
      title:
        typeof c.title === "string" && c.title.trim().length > 0
          ? c.title
          : c.name || "",
      slug: c.slug,
      image: c.image || "",
      description: c.description || "",
      status: c.status || "ACTIVE",
    }));

    res.json({ ok: true, data: categories });
  } catch (error) {
    console.error("❌ Categories fetch error:", error);
    res.status(500).json({ ok: false, message: "Failed to fetch categories" });
  }
});

/**
 * Single category by slug
 * - Also coalesce title from name
 */
router.get("/categories/:slug", async (req, res) => {
  try {
    const c: any = await Category.findOne({
      slug: req.params.slug,
      status: "ACTIVE",
    })
      .select("_id title name slug image description status")
      .lean();

    if (!c) {
      return res.status(404).json({ ok: false, message: "Category not found" });
    }

    const cat = {
      _id: String(c._id),
      title:
        typeof c.title === "string" && c.title.trim().length > 0
          ? c.title
          : c.name || "",
      slug: c.slug,
      image: c.image || "",
      description: c.description || "",
      status: c.status || "ACTIVE",
    };

    res.json({ ok: true, data: cat });
  } catch (error) {
    console.error("❌ Category fetch error:", error);
    res.status(500).json({ ok: false, message: "Failed to fetch category" });
  }
});

export default router;
