// src/services/invoice.service.ts
import { InvoiceModel } from "../models/Invoice.model.js";
import { InvoiceSequenceModel } from "../models/Invoice-sequence.model.js";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
/**
 * Invoice service (Mongoose + TS)
 * - getNextInvoiceNumber: upsert + $inc for per-account sequence
 * - createInvoice: compute totals + insert invoice doc
 * - getInvoice, listInvoices: simple read helpers
 *
 * Adjust field names if your models differ.
 */
export async function getNextInvoiceNumber(accountId) {
    const seq = await InvoiceSequenceModel.findOneAndUpdate({ accountId }, { $inc: { lastSequence: 1 } }, { new: true, upsert: true }).lean();
    // defensive: if seq is null (shouldn't with upsert) handle gracefully
    const lastSeq = seq?.lastSequence ?? 1;
    const seqVal = String(lastSeq).padStart(6, "0");
    const yyyymm = new Date().toISOString().slice(0, 7).replace("-", "");
    return `INV-${accountId}-${yyyymm}-${seqVal}`;
}
export async function createInvoice(accountId, payload, createdBy) {
    const invoiceNumber = await getNextInvoiceNumber(accountId);
    let subtotal = 0;
    let taxTotal = 0;
    const items = (payload.items || []).map((it) => {
        const q = Number(it.quantity || 0);
        const up = Number(it.unitPrice || 0);
        const tp = Number(it.taxPercent || 0);
        const line = +(q * up).toFixed(2);
        const tax = +((line * tp) / 100).toFixed(2);
        subtotal += line;
        taxTotal += tax;
        return {
            description: it.description,
            quantity: q,
            unitPrice: up,
            taxPercent: tp,
            lineTotal: +(line + tax).toFixed(2),
        };
    });
    const discount = Number(payload.discountAmount || 0);
    const total = +(subtotal + taxTotal - discount).toFixed(2);
    const doc = await InvoiceModel.create({
        accountId: accountId ? new Types.ObjectId(accountId) : undefined,
        invoiceNumber,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        billingAddress: payload.billingAddress,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
        currency: payload.currency || "BDT",
        notes: payload.notes,
        subtotal,
        taxTotal,
        discountAmount: discount,
        total,
        createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
        items,
        status: "draft",
        pdfStatus: "none",
    });
    return doc.toObject();
}
export async function getInvoice(id) {
    // allow either id string or ObjectId
    return InvoiceModel.findById(id).lean();
}
export async function listInvoices(accountId, limit = 100) {
    const query = {};
    if (accountId) {
        try {
            query.accountId = new Types.ObjectId(accountId);
        }
        catch (e) {
            // if invalid id, fallback to string match (defensive)
            query.accountId = accountId;
        }
    }
    return InvoiceModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}
/**
 * Create invoice from an order document.
 * Reuses getNextInvoiceNumber and writes guestToken + orderId.
 */
export async function createInvoiceFromOrder(order, createdBy) {
    const items = (order.items || []).map((it) => {
        const quantity = Number(it.quantity ?? it.qty ?? 1);
        const unitPrice = Number(it.unitPrice ?? it.price ?? it.unit_price ?? 0);
        const taxPercent = Number(it.taxPercent ?? 0);
        const line = parseFloat((quantity * unitPrice).toFixed(2));
        const tax = parseFloat(((line * taxPercent) / 100).toFixed(2));
        return {
            description: it.name ?? it.title ?? it.productName ?? "Item",
            quantity,
            unitPrice,
            taxPercent,
            lineTotal: parseFloat((line + tax).toFixed(2)),
        };
    });
    const subtotal = items.reduce((s, it) => s + parseFloat((it.quantity * it.unitPrice).toFixed(2)), 0);
    const taxTotal = items.reduce((s, it) => s +
        parseFloat(((it.quantity * it.unitPrice * (it.taxPercent || 0)) / 100).toFixed(2)), 0);
    const discountAmount = Number(order.discountAmount ?? 0);
    const total = parseFloat((subtotal + taxTotal - discountAmount).toFixed(2));
    const invoiceNumber = await getNextInvoiceNumber(String(order.accountId ?? (order.accountId || "1")));
    const guestToken = uuidv4();
    const customerContact = {
        name: order.customerName ??
            order.shipping?.name ??
            order.billing?.name ??
            undefined,
        email: order.customerEmail ?? order.billing?.email ?? undefined,
        phone: order.customerPhone ?? order.shipping?.phone ?? undefined,
    };
    const doc = await InvoiceModel.create({
        orderId: order._id ? new Types.ObjectId(order._id) : order._id,
        accountId: order.accountId
            ? new Types.ObjectId(order.accountId)
            : undefined,
        invoiceNumber,
        guestToken,
        customerContact,
        items,
        subtotal,
        taxTotal,
        discountAmount,
        total,
        status: "draft",
        pdfStatus: "none",
        createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
    });
    return doc.toObject();
}
export async function findInvoiceByGuestToken(token) {
    return InvoiceModel.findOne({ guestToken: token }).lean();
}
