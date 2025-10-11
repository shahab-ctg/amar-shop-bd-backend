import { dbconnect } from "@/db/connection.js";
import { Product } from "@/models/Product.js";
import { Router } from "express";


const router = Router();

router.get("/products", async ( _req, res, next) => {

  try {
    await dbconnect();
    const items = await Product.find({}).sort({createdAt: -1}).limit(50).lean()

    res.json({ok: true, data: items})
    
  } catch (error) {
    next(error)
    
  }
})

export default router;