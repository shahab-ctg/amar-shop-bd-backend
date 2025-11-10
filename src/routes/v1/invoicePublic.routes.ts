// src/routes/public/invoicePublic.routes.ts
import express from "express";
import { InvoiceModel } from "../../models/Invoice.model.js";

const router = express.Router();


router.get("/by-order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const inv = await InvoiceModel.findOne({ orderId }).lean();
    if (!inv) return res.status(404).json({ error: "not found" });
    return res.json(inv);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server error" });
  }
});

export default router;
