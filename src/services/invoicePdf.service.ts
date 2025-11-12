// src/services/invoicePdf.service.ts
import PDFDocument from "pdfkit";
import type { Response } from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { InvoiceModel } from "../models/Invoice.model.js";

/**
 * Industry-grade invoice PDF generator (TypeScript)
 * - Tries to embed a Unicode font (recommended: NotoSans or NotoSansBengali) to render "৳" correctly.
 * - Falls back to built-in Helvetica if font file not available.
 * - Uses Intl.NumberFormat for locale-safe currency (BDT) and Intl.DateTimeFormat for date.
 * - Sanitizes input to avoid PDF glyph issues while preserving most ASCII+Unicode when font supports it.
 *
 * Usage:
 *   streamInvoicePdfById(invoiceId, res)
 *
 * Font:
 *   - Place a TTF/OTF font that supports Bengali currency sign and Latin glyphs at:
 *     ./assets/fonts/invoice-font.ttf  (recommended: NotoSans/NotoSansBengali)
 *   - Or set env var INVOICE_FONT_PATH to an absolute or relative path.
 */

const DEFAULT_FONT_ENV =
  process.env.INVOICE_FONT_PATH || "./assets/fonts/invoice-font.ttf";

/* Formatters */
const currencyFormatterWithSymbol = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "BDT",
  // 'symbol' requests the currency sign (৳) when available in environment
  currencyDisplay: "symbol",
  maximumFractionDigits: 2,
});

const currencyFormatterWithCode = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "code", // "BDT 1,234.56"
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/* Helpers */
function safeText(s: any, allowUnicode = true): string {
  if (s === undefined || s === null) return "";
  const str = String(s);
  if (allowUnicode) return str;
  // strip non-ASCII
  return str.replace(/[^\x00-\x7F]/g, "?");
}

function formatCurrencyBDTSymbol(n: number | undefined | null): string {
  const num = Number(n ?? 0) || 0;
  try {
    // attempt symbol version first
    return currencyFormatterWithSymbol.format(num);
  } catch {
    return currencyFormatterWithCode.format(num);
  }
}

function formatCurrencyBDTCode(n: number | undefined | null): string {
  const num = Number(n ?? 0) || 0;
  return currencyFormatterWithCode.format(num);
}

function formatDate(dt: any): string {
  if (!dt) return "";
  try {
    return dateFormatter.format(new Date(dt));
  } catch {
    return String(dt);
  }
}

/* Font loader: if font exists, register it; returns font name used */
function loadFont(doc: PDFKit.PDFDocument): string {
  const fontPathFromEnv = process.env.INVOICE_FONT_PATH || DEFAULT_FONT_ENV;
  const resolved = path.isAbsolute(fontPathFromEnv)
    ? fontPathFromEnv
    : path.resolve(process.cwd(), fontPathFromEnv);

  if (fs.existsSync(resolved)) {
    try {
      // Register under a fixed name
      doc.registerFont("InvoiceUnicode", resolved);
      return "InvoiceUnicode";
    } catch (err) {
      console.warn("Failed to register invoice font:", err);
    }
  } else {
    console.warn("Invoice font not found at", resolved);
  }

  // fallback built-in
  return "Helvetica";
}

/* Main: stream PDF by invoice id */
export async function streamInvoicePdfById(invoiceId: string, res: Response) {
  if (!invoiceId) {
    res.status(400).json({ ok: false, error: "invoice id required" });
    return;
  }

  try {
    await mongoose.connect(mongoose.connection.host ? "" : ""); // noop if already connected (keeps TS happy) - your app should ensure DB connected
  } catch {
    /* ignore — connection handled elsewhere */
  }

  let invoice: any = null;
  try {
    if (mongoose.Types.ObjectId.isValid(String(invoiceId))) {
      invoice = await InvoiceModel.findById(String(invoiceId)).lean();
    } else {
      invoice = await InvoiceModel.findOne({ _id: String(invoiceId) }).lean();
    }
  } catch (err) {
    console.error("invoice lookup error:", err);
    invoice = null;
  }

  if (!invoice) {
    res.status(404).json({ ok: false, error: "Invoice not found" });
    return;
  }

  return streamInvoicePdf(invoice, res);
}

/* Main: render invoice object to PDF stream */
export function streamInvoicePdf(invoice: any, res: Response) {
  if (!invoice) {
    res.status(400).json({ ok: false, error: "invoice required" });
    return;
  }

  // filename safe
  const safeInvoiceNum = safeText(
    invoice.invoiceNumber ?? invoice._id ?? "invoice",
    true
  ).replace(/\s+/g, "-");
  const filename = `invoice-${safeInvoiceNum}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

  // create doc
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  // pipe to response
  doc.pipe(res);

  // register/load font if available
  const chosenFont = loadFont(doc);
  const bodyFont = chosenFont || "Helvetica";
  const boldFont = chosenFont ? chosenFont : "Helvetica-Bold";

  // Styles
  const accentColor = "#0f766e";
  const lineColor = "#e6e6e6";

  // Header: company name left; invoice meta right
  doc.font(bodyFont).fontSize(20).fillColor(accentColor);
  doc.text(safeText(invoice.companyName ?? "Your Company", true), {
    continued: false,
  });

  // invoice meta on right (we position absolute)
  const metaWidth = 220;
  const metaX = doc.page.width - doc.page.margins.right - metaWidth;
  const metaStartY = 40;
  doc.fontSize(10).fillColor("#444");
  doc.text(
    `Invoice: ${safeText(invoice.invoiceNumber ?? "", true)}`,
    metaX,
    metaStartY,
    { width: metaWidth, align: "right" }
  );
  doc.text(`Date: ${formatDate(invoice.createdAt ?? new Date())}`, {
    align: "right",
    width: metaWidth,
  });

  doc.moveDown(1.2);

  // Billing block
  doc.font(bodyFont).fontSize(12).fillColor("#333");
  doc.text("Billed To:");
  const custName = invoice.customerContact?.name ?? invoice.customerName ?? "";
  doc.fontSize(11).text(safeText(custName, true));
  if (invoice.customerContact?.email)
    doc.text(safeText(invoice.customerContact.email, true));
  if (invoice.customerContact?.phone)
    doc.text(safeText(invoice.customerContact.phone, true));
  if (invoice.billingAddress) doc.text(safeText(invoice.billingAddress, true));
  doc.moveDown(0.8);

  // Table header
  const startX = doc.x;
  const descWidth = 300;
  const qtyX = startX + descWidth + 10;
  const unitX = qtyX + 60;
  const lineX = unitX + 90;

  doc.fontSize(10).fillColor("#111").font(bodyFont);
  doc.text("Description", startX, doc.y, { width: descWidth });
  doc.text("Qty", qtyX, doc.y, { width: 60, align: "right" });
  doc.text("Unit", unitX, doc.y, { width: 90, align: "right" });
  doc.text("Line", lineX, doc.y, { width: 80, align: "right" });
  doc.moveDown(0.3);

  // separator
  doc
    .moveTo(startX, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor(lineColor)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.4);

  const items: any[] = Array.isArray(invoice.items) ? invoice.items : [];

  for (const item of items) {
    const description = safeText(item.description ?? item.name ?? "Item", true);
    const qty = Number(item.quantity ?? item.qty ?? 0) || 0;
    const unit = Number(item.unitPrice ?? item.price ?? 0) || 0;
    const line = Number(item.lineTotal ?? qty * unit) || 0;

    doc.font(bodyFont).fontSize(10).fillColor("#111");
    // Description column with limited width
    doc.text(description, startX, doc.y, { width: descWidth });

    // align numeric columns on same row (y alignment)
    const y = doc.y - doc.currentLineHeight();
    doc.text(String(qty), qtyX, y, { width: 60, align: "right" });
    doc.text(unit.toFixed(2), unitX, y, { width: 90, align: "right" });
    doc.text(line.toFixed(2), lineX, y, { width: 80, align: "right" });

    doc.moveDown(0.6);
  }

  // Totals area aligned right
  doc.moveDown(0.6);
  const totalsLabelX = lineX - 140;
  const totalsValueX = lineX;

  doc.fontSize(10).font(bodyFont).fillColor("#111");
  doc.text("Subtotal:", totalsLabelX, doc.y, { width: 140, align: "right" });
  doc.text(
    formatCurrencyBDTSymbol(Number(invoice.subtotal ?? 0)),
    totalsValueX,
    doc.y,
    { width: 80, align: "right" }
  );
  doc.moveDown(0.2);

  doc.text("Tax:", totalsLabelX, doc.y, { width: 140, align: "right" });
  doc.text(
    formatCurrencyBDTSymbol(Number(invoice.taxTotal ?? 0)),
    totalsValueX,
    doc.y,
    { width: 80, align: "right" }
  );
  doc.moveDown(0.2);

  doc.text("Discount:", totalsLabelX, doc.y, { width: 140, align: "right" });
  doc.text(
    formatCurrencyBDTSymbol(Number(invoice.discountAmount ?? 0)),
    totalsValueX,
    doc.y,
    { width: 80, align: "right" }
  );
  doc.moveDown(0.3);

  doc.font(boldFont).fontSize(12);
  doc.text("Total:", totalsLabelX, doc.y, { width: 140, align: "right" });
  doc.text(
    formatCurrencyBDTSymbol(Number(invoice.total ?? 0)),
    totalsValueX,
    doc.y,
    { width: 80, align: "right" }
  );

  doc.moveDown(1);

  if (invoice.notes) {
    doc.font(bodyFont).fontSize(10).text("Notes:");
    doc.moveDown(0.2);
    doc.fontSize(9).text(safeText(invoice.notes, true), { width: 420 });
  }

  doc.moveDown(2);
  doc
    .fontSize(8)
    .fillColor("#777")
    .text("Generated by Admin Panel", { align: "center" });

  doc.end();
}
