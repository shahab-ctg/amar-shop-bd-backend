// src/services/invoicePdf.service.ts
import PDFDocument from "pdfkit";
import mongoose from "mongoose";
import { InvoiceModel } from "../models/Invoice.model.js";
/* Helper functions */
function safeText(s, maxLength = 200) {
    if (s === undefined || s === null)
        return "";
    let str = String(s).trim();
    // Remove problematic characters and limit length
    str = str.replace(/[^\x00-\x7F]/g, "").substring(0, maxLength);
    return str || "N/A";
}
function formatCurrency(n) {
    const num = Number(n ?? 0) || 0;
    // Use "BDT" instead of symbol to avoid font issues
    return `BDT ${num.toFixed(2)}`;
}
function formatDate(dt) {
    if (!dt)
        return "N/A";
    try {
        const date = new Date(dt);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }
    catch {
        return "N/A";
    }
}
function validateInvoice(invoice) {
    return invoice && typeof invoice === "object";
}
/* Font loader - Use only built-in fonts */
function setupFonts(doc) {
    return {
        bodyFont: "Helvetica",
        boldFont: "Helvetica-Bold",
        titleFont: "Helvetica-Bold",
    };
}
/* Database connection */
async function ensureDbConnection() {
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI || "");
        }
    }
    catch (error) {
        console.error("Database connection error:", error);
        throw new Error("Database connection failed");
    }
}
/* Fix for the Type error - Proper type handling */
async function fetchInvoice(invoiceId) {
    let invoice = null;
    if (mongoose.Types.ObjectId.isValid(invoiceId)) {
        invoice = await InvoiceModel.findById(invoiceId).lean();
    }
    else {
        invoice = await InvoiceModel.findOne({ invoiceNumber: invoiceId }).lean();
    }
    // Transform the MongoDB document to match our Invoice type
    if (invoice) {
        return {
            _id: invoice._id?.toString(),
            invoiceNumber: invoice.invoiceNumber,
            companyName: invoice.companyName,
            createdAt: invoice.createdAt,
            customerContact: invoice.customerContact,
            customerName: invoice.customerName,
            billingAddress: invoice.billingAddress,
            items: invoice.items,
            subtotal: invoice.subtotal,
            taxTotal: invoice.taxTotal,
            discountAmount: invoice.discountAmount,
            total: invoice.total,
            notes: invoice.notes,
        };
    }
    return null;
}
/* Main: stream PDF by invoice id */
export async function streamInvoicePdfById(invoiceId, res) {
    if (!invoiceId?.trim()) {
        res.status(400).json({ ok: false, error: "Invoice ID is required" });
        return;
    }
    try {
        await ensureDbConnection();
    }
    catch (error) {
        res.status(500).json({ ok: false, error: "Database connection failed" });
        return;
    }
    let invoice = null;
    try {
        invoice = await fetchInvoice(invoiceId);
    }
    catch (err) {
        console.error("Invoice lookup error:", err);
        res.status(500).json({ ok: false, error: "Failed to fetch invoice" });
        return;
    }
    if (!validateInvoice(invoice)) {
        res.status(404).json({ ok: false, error: "Invoice not found" });
        return;
    }
    return streamInvoicePdf(invoice, res);
}
/* Main: render invoice object to PDF stream */
export function streamInvoicePdf(invoice, res) {
    if (!validateInvoice(invoice)) {
        res.status(400).json({ ok: false, error: "Invalid invoice data" });
        return;
    }
    // Safe filename generation
    const safeInvoiceNum = safeText(invoice.invoiceNumber ?? invoice._id ?? "invoice").replace(/[^a-zA-Z0-9-_]/g, "-");
    const filename = `invoice-${safeInvoiceNum}.pdf`;
    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    // Create PDF document
    const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
            Title: `Invoice ${safeInvoiceNum}`,
            Author: invoice.companyName || "Company",
            Subject: "Invoice Document",
        },
    });
    // Pipe to response
    doc.pipe(res);
    // Setup fonts
    const { bodyFont, boldFont, titleFont } = setupFonts(doc);
    // Design constants
    const primaryColor = "#1e40af";
    const secondaryColor = "#6b7280";
    const accentColor = "#059669";
    const borderColor = "#e5e7eb";
    const textColor = "#111827";
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rightColumn = 400;
    // Header Section
    doc
        .fillColor(primaryColor)
        .font(titleFont)
        .fontSize(24)
        .text(safeText(invoice.companyName || "YOUR COMPANY"), 50, 50);
    doc
        .fillColor(secondaryColor)
        .font(bodyFont)
        .fontSize(12)
        .text("INVOICE", 50, 85);
    // Invoice metadata (right side)
    doc
        .fillColor(textColor)
        .font(boldFont)
        .fontSize(10)
        .text("INVOICE #:", rightColumn, 50, { continued: true })
        .font(bodyFont)
        .text(safeText(invoice.invoiceNumber || "N/A"));
    doc
        .font(boldFont)
        .text("DATE:", rightColumn, 65, { continued: true })
        .font(bodyFont)
        .text(formatDate(invoice.createdAt));
    doc
        .font(boldFont)
        .text("STATUS:", rightColumn, 80, { continued: true })
        .fillColor(accentColor)
        .text("PAID");
    // Separator line
    doc
        .moveTo(50, 120)
        .lineTo(doc.page.width - 50, 120)
        .strokeColor(borderColor)
        .lineWidth(1)
        .stroke();
    // Billing Information
    const billY = 140;
    doc
        .fillColor(primaryColor)
        .font(boldFont)
        .fontSize(11)
        .text("BILL TO:", 50, billY);
    doc.fillColor(textColor).font(bodyFont).fontSize(10);
    const customerName = invoice.customerContact?.name || invoice.customerName || "Customer";
    doc.text(safeText(customerName), 50, billY + 15);
    if (invoice.customerContact?.email) {
        doc.text(safeText(invoice.customerContact.email), 50, billY + 30);
    }
    if (invoice.customerContact?.phone) {
        doc.text(safeText(invoice.customerContact.phone), 50, billY + 45);
    }
    if (invoice.billingAddress) {
        doc.text(safeText(invoice.billingAddress), 50, billY + 60, {
            width: 250,
            lineGap: 2,
        });
    }
    // Items Table
    const tableTop = 240;
    // Table Header
    doc.fillColor(primaryColor).font(boldFont).fontSize(10);
    doc.text("DESCRIPTION", 50, tableTop);
    doc.text("QTY", 350, tableTop, { width: 50, align: "right" });
    doc.text("UNIT PRICE", 410, tableTop, { width: 80, align: "right" });
    doc.text("AMOUNT", 500, tableTop, { width: 80, align: "right" });
    // Table header line
    doc
        .moveTo(50, tableTop + 12)
        .lineTo(doc.page.width - 50, tableTop + 12)
        .strokeColor(primaryColor)
        .lineWidth(1)
        .stroke();
    // Table Rows
    let currentY = tableTop + 25;
    const items = Array.isArray(invoice.items)
        ? invoice.items
        : [];
    doc.fillColor(textColor).font(bodyFont).fontSize(9);
    if (items.length === 0) {
        doc.text("No items in this invoice", 50, currentY);
        currentY += 20;
    }
    else {
        items.forEach((item, index) => {
            if (currentY > doc.page.height - 150) {
                doc.addPage();
                currentY = 50;
            }
            const description = safeText(item.description || item.name || `Item ${index + 1}`);
            const quantity = Number(item.quantity ?? item.qty ?? 0);
            const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
            const lineTotal = Number(item.lineTotal ?? quantity * unitPrice);
            // Description
            doc.text(description, 50, currentY, { width: 280 });
            // Numeric values
            doc.text(quantity.toString(), 350, currentY, {
                width: 50,
                align: "right",
            });
            doc.text(formatCurrency(unitPrice), 410, currentY, {
                width: 80,
                align: "right",
            });
            doc.text(formatCurrency(lineTotal), 500, currentY, {
                width: 80,
                align: "right",
            });
            currentY += 15;
            // Row separator
            if (index < items.length - 1) {
                doc
                    .moveTo(50, currentY - 5)
                    .lineTo(doc.page.width - 50, currentY - 5)
                    .strokeColor(borderColor)
                    .lineWidth(0.5)
                    .stroke();
                currentY += 5;
            }
        });
    }
    // Totals section
    const totalsStartY = Math.max(currentY + 20, doc.page.height - 150);
    doc
        .moveTo(400, totalsStartY)
        .lineTo(doc.page.width - 50, totalsStartY)
        .strokeColor(borderColor)
        .lineWidth(1)
        .stroke();
    const subtotal = Number(invoice.subtotal ?? 0);
    const tax = Number(invoice.taxTotal ?? 0);
    const discount = Number(invoice.discountAmount ?? 0);
    const total = Number(invoice.total ?? subtotal + tax - discount);
    let totalsY = totalsStartY + 10;
    doc.font(bodyFont).fontSize(9).fillColor(textColor);
    doc.text("Subtotal:", 400, totalsY, { width: 100, align: "right" });
    doc.text(formatCurrency(subtotal), 500, totalsY, {
        width: 80,
        align: "right",
    });
    totalsY += 15;
    if (tax > 0) {
        doc.text("Tax:", 400, totalsY, { width: 100, align: "right" });
        doc.text(formatCurrency(tax), 500, totalsY, { width: 80, align: "right" });
        totalsY += 15;
    }
    if (discount > 0) {
        doc.text("Discount:", 400, totalsY, { width: 100, align: "right" });
        doc.text(`-${formatCurrency(discount)}`, 500, totalsY, {
            width: 80,
            align: "right",
        });
        totalsY += 15;
    }
    // Total line
    doc
        .moveTo(400, totalsY)
        .lineTo(doc.page.width - 50, totalsY)
        .strokeColor(primaryColor)
        .lineWidth(1)
        .stroke();
    totalsY += 10;
    doc.font(boldFont).fontSize(11).fillColor(primaryColor);
    doc.text("TOTAL:", 400, totalsY, { width: 100, align: "right" });
    doc.text(formatCurrency(total), 500, totalsY, { width: 80, align: "right" });
    // Notes section
    if (invoice.notes) {
        const notesY = totalsY + 30;
        doc
            .font(boldFont)
            .fontSize(9)
            .fillColor(primaryColor)
            .text("NOTES:", 50, notesY);
        doc
            .font(bodyFont)
            .fontSize(8)
            .fillColor(textColor)
            .text(safeText(invoice.notes, 500), 50, notesY + 12, {
            width: pageWidth,
            lineGap: 3,
        });
    }
    // Footer
    const footerY = doc.page.height - 40;
    doc
        .font(bodyFont)
        .fontSize(8)
        .fillColor(secondaryColor)
        .text("Thank you for your business!", 50, footerY, { align: "center" })
        .text("Generated by Admin System", 50, footerY + 12, { align: "center" });
    doc.end();
}
