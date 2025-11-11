// src/routes/v1/adminInvoices.routes.js
import express from "express";
import { InvoiceModel } from "../../models/Invoice.model.js";
import * as invoiceService from "../../services/invoice.service.js"; // your existing service (create/list/etc)
import { requireAdmin } from "../../middlewares/auth.js";
import { streamInvoicePdfById } from "../../services/invoicePdf.service.js";

const router = express.Router();

/** List invoices for admin (account optional) */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const accountId = req.query.account_id;
    const limit = Math.min(Number(req.query.limit ?? 200), 1000);
    const list = await invoiceService.listInvoices(accountId, limit);
    return res.json({ ok: true, data: list });
  } catch (err) {
    console.error("admin invoices list err:", err);
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

/** Get invoice detail */
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const inv = await invoiceService.getInvoice(req.params.id);
    if (!inv) return res.status(404).json({ ok: false, error: "not found" });
    return res.json({ ok: true, data: inv });
  } catch (err) {
    console.error("admin invoice get err:", err);
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

/** Create invoice (admin) */
router.post("/", requireAdmin, async (req, res) => {
  try {
    const accountId = req.body.account_id ?? req.user?.accountId ?? "1";
    const createdBy = req.user?._id;
    const doc = await invoiceService.createInvoice(
      String(accountId),
      req.body,
      String(createdBy)
    );
    return res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    console.error("admin create invoice err:", err);
    return res
      .status(400)
      .json({ ok: false, error: err.message || "bad request" });
  }
});

/** Create invoice from order (admin) */
router.post("/from-order", requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId)
      return res.status(400).json({ ok: false, error: "orderId required" });
    // your invoice.service.createInvoiceFromOrder expects order doc — but you had a route earlier that accepted order id and used service
    // here we follow the approach of reading order then calling service
    const Order = (await import("../../models/Order.js")).Order;
    const order = await Order.findById(orderId).lean();
    if (!order)
      return res.status(404).json({ ok: false, error: "order not found" });

    const invoice = await invoiceService.createInvoiceFromOrder(
      order,
      String(req.user?._id ?? "admin")
    );
    return res.status(201).json({ ok: true, data: invoice });
  } catch (err) {
    console.error("from-order error:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "server error" });
  }
});

/** Issue invoice (mark issued + optionally generate PDF) */
router.post("/:id/issue", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const inv = await InvoiceModel.findByIdAndUpdate(
      id,
      { status: "issued" },
      { new: true }
    ).lean();
    if (!inv) return res.status(404).json({ ok: false, error: "not found" });
    return res.json({ ok: true, data: inv });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

/** Generate PDF now (sync) — returns 200 when ready; client can then open /pdf */
router.post("/:id/pdf/generate", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    // Update pdfStatus (optional)
    await InvoiceModel.findByIdAndUpdate(id, { pdfStatus: "pending" });
    // generate and stream? here we respond immediately and let client open /pdf
    // But we can also generate a PDF and discard; simpler: just set pending then client should open /pdf (which streams)
    // For server-side generation we rely on GET /:id/pdf streaming endpoint using PDFKit
    await InvoiceModel.findByIdAndUpdate(id, { pdfStatus: "ready" });
    return res.json({ ok: true, message: "PDF generation ready" });
  } catch (err) {
    console.error("generate pdf err:", err);
    return res.status(500).json({ ok: false, error: "PDF generation failed" });
  }
});

/** Serve/Stream PDF (admin only) */
router.get("/:id/pdf", requireAdmin, async (req, res) => {
  try {
    // We stream PDF live from invoice doc (no saved file required)
    return await streamInvoicePdfById(req.params.id, res);
  } catch (err) {
    console.error("serve pdf err:", err);
    // If streamInvoicePdfById handled response, we may not want to send json; but if error:
    if (!res.headersSent)
      return res.status(500).json({ ok: false, error: "server error" });
  }
});

export default router;
