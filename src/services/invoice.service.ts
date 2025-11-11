// src/services/invoice.service.js
import mongoose from "mongoose";
import { InvoiceModel } from "../models/Invoice.model.js"; // adjust path if needed

/**
 * Helper: normalizeOrder
 * - if arg is an object -> assume it's an order doc already (lean)
 * - if arg is a string -> try ObjectId, numeric or string lookups
 */
export async function resolveOrder(orderOrId) {
 const OrderModule: any = await import("../models/Order.js");
 const Order = OrderModule?.Order ?? OrderModule?.default ?? OrderModule;
 if (!Order || typeof Order.findOne !== "function") {
   throw new Error("Order model not available");
 }

  if (!Order || typeof Order.findOne !== "function") {
    throw new Error("Order model not available");
  }

  // already order-like object (assume lean)
  if (orderOrId && typeof orderOrId === "object" && orderOrId._id) {
    return orderOrId;
  }

  // try string id
  if (typeof orderOrId === "string") {
    // 1) if valid ObjectId -> findById
    if (mongoose.Types.ObjectId.isValid(orderOrId)) {
      const ord = await Order.findById(orderOrId).lean();
      if (ord) return ord;
    }

    // 2) numeric fallback
    const maybeNum = Number(orderOrId);
    if (!Number.isNaN(maybeNum)) {
      const ord = await Order.findOne({ orderId: maybeNum }).lean();
      if (ord) return ord;
    }

    // 3) string-field fallback
    const ord = await Order.findOne({ orderId: String(orderOrId) }).lean();
    if (ord) return ord;

    // not found
    return null;
  }

  // unknown type
  return null;
}

/**
 * createInvoiceFromOrder(orderOrId, createdBy)
 * - orderOrId may be: order object OR order id/identifier
 * - createdBy is string id of admin
 *
 * IMPORTANT:
 * - Only set ObjectId fields (orderId, accountId, createdBy) if the value is a valid ObjectId.
 * - Otherwise omit them to avoid Mongoose casting errors.
 */
export async function createInvoiceFromOrder(orderOrId, createdBy = "admin") {
  // resolve order safely
  const order = await resolveOrder(orderOrId);
  if (!order) throw new Error("order not found");

  // safe helpers
  const safeObjectId = (val) => {
    if (!val) return undefined;
    try {
     if (mongoose.Types.ObjectId.isValid(String(val))) {
       return new mongoose.Types.ObjectId(String(val));
     }
    } catch (e) {
      // ignore
    }
    return undefined;
  };

  // Build invoice payload from order doc — adapt fields as needed
  const invoicePayload = {
    // only set accountId if valid ObjectId
    ...(order.accountId ? { accountId: safeObjectId(order.accountId) } : {}),
    // only set orderId if order._id exists and is valid ObjectId
    ...(order._id ? { orderId: safeObjectId(order._id) } : {}),
    invoiceNumber: String(
      // keep existing invoiceNumber generation if you have one; fallback to timestamp
      order.invoiceNumber ?? `INV-${Date.now()}`
    ),
    // fallback guestToken / customerContact fields as before
    customerContact: {
      name:
        order.customer?.name ??
        order.customerName ??
        order.billing?.name ??
        "Customer",
      email:
        order.customer?.email ??
        order.customerEmail ??
        order.billing?.email ??
        undefined,
      phone:
        order.customer?.phone ??
        order.customerPhone ??
        order.billing?.phone ??
        undefined,
    },
    items:
      Array.isArray(order.lines) && order.lines.length
        ? order.lines.map((l) => ({
            description: l.title ?? l.name ?? "Item",
            quantity: l.qty ?? l.quantity ?? 1,
            unitPrice: l.price ?? 0,
            lineTotal: (l.price ?? 0) * (l.qty ?? l.quantity ?? 1),
            // productId can be string (no casting to ObjectId here)
            productId: l.productId ? String(l.productId) : undefined,
          }))
        : [],
    subtotal: order.totals?.subTotal ?? order.subTotal ?? 0,
    taxTotal: order.totals?.tax ?? 0,
    discountAmount: 0,
    total: order.totals?.grandTotal ?? order.grandTotal ?? 0,
    currency: order.currency ?? "BDT",
    status: "draft",
    // createdBy ONLY if valid ObjectId, otherwise omit (avoid invalid cast)
    ...(createdBy ? { createdBy: safeObjectId(createdBy) } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
    // if you want to preserve a textual order identifier for non-ObjectId orders,
    // store it in a non-ObjectId field so searches can work (OPTIONAL)
    ...(order.orderId && !mongoose.Types.ObjectId.isValid(String(order.orderId))
      ? { orderRef: String(order.orderId) }
      : {}),
  };

  // create invoice doc
  const created = await InvoiceModel.create(invoicePayload);
  // return plain object (lean-like)
  const doc = created.toObject ? created.toObject() : created;
  return doc;
}
