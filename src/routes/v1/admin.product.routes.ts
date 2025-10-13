import { NextFunction, Router, Request, Response } from "express";
import { Types } from "mongoose";
import { resolve } from "path";
import { dbConnect } from "src/db/connection.js";
import { requireAdmin } from "src/middlewares/auth.js";
import { Product } from "src/models/Product.js";
import z from "zod";





const router = Router();

const AdminCreateProductDTO = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  price: z.number().nonnegative(),
  stock: z.number().nonnegative().default(0),
  image: z.string().optional(),
  compareAtPrice: z.number().nonnegative().optional(),
  isDiscounted: z.boolean().optional().default(false),
  status: z.enum(["ACTIVE", "DRAFT", "HIDDEN"]).optional().default("ACTIVE"),
  categorySlug: z.string().optional(),
  tagSlugs: z.array(z.string()).optional().default([])
})

// To do===Admin Auth

// POST /api/v1/admin/products
router.post("/admin/products", adminAuth, async ( req: Request, res: Response, next: NextFunction) => {
  try {
    await dbConnect();
    const body = AdminCreateProductDTO.parse(req.body)

    const created = await Product.create({
      title: body.title,
      slug: body.slug,
      price: body.price,
      stock: body.stock,
      image: body.image,
      compareAtPrice: body.compareAtPrice,
      isDiscounted: body.isDiscounted,
      status: body.status,
      categorySlug: body.categorySlug,
      tagSlugs: body.tagSlugs
    })

    return res.status(201).json({
      ok: true,
      data: {id: created._id.toString(), slug: created.slug}
    })
    
  } catch (err) {
    if(err?.name === "MongoServerError" && err.code === 11000){
      return res.status(409).json({ok: false, code: "DUPLICATE_KEY", details: err.keyValue})
    }
    next(err) 
  }
});


// update===PATCH /api/v1/admin/products/:id

const IdParam = z.object({
  id: z.string().refine(Types.ObjectId.isValid, "Invalid ObjectId")
})

const AdminUpdateProductDTO = AdminCreateProductDTO.partial()
.refine((d) => Object.keys(d).length > 0, { message: "At least one field required"});


router.patch("/admin/products/:id", requireAdmin, async ( req, res, next) => {
  try {
    await dbConnect();
    const {id} = IdParam .parse(req.params);
    const body = AdminUpdateProductDTO.parse(req.body);

    const updated = await Product.findByIdAndUpdate(id,
      { $set: body },
      { new: true, runValidators: true}).lean();

      if(!updated) return res.status(404).json({ok: false, code: "NOT_FOUND"});

      res.json({ok: true, data: {...updated, _id: updated._id.toString()}})
  } catch (err) {
    if(err?.name === "MongoServerError" && err.code === 11000) {
      return res.status(409).json({ok: false, code: "DUPLICATE_KEY", details: err.keyValue })
    } 
    next()
  }
})


//  DELETE /api/v1/admin/products/:id======

router.delete("/admin/products/:id", requireAdmin, async ( req, res, next) => {
  try {
    await dbConnect();
    const {id} = IdParam.parse(req.params);

    const out = await Product.findByIdAndDelete(id).lean();
    if(!out) return res.status(404).json({ok: false, code: "NOT_FOUND"})

      res.json({ok: true, data: {id}});
    
    
  } catch (err) {
    next(err)
    
  }
})

export default router