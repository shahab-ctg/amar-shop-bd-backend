// src/models/Order.ts
import { Schema, model } from "mongoose";
import type { IOrderDocument, IOrderModel } from "../types/mongoose.types.js";

const orderSchema = new Schema<IOrderDocument, IOrderModel>(
  {
    // Idempotency key to prevent duplicate orders
    idempotencyKey: { type: String, index: { unique: true, sparse: true } },

    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "IN_SHIPPING", "DELIVERED", "CANCELLED"],
      default: "PENDING",
      required: true,
    },

    lines: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        qty: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 }, // store unit price from DB
        image: String,
        title: String,
      },
    ],

    notes: { type: String, default: "" },

    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true, index: true },
      email: String,
      address: String,
      area: String,
      houseOrVillage: String,
      roadOrPostOffice: String,
      blockOrThana: String,
      district: String,
    },

    totals: {
      subTotal: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
    },

    payment: Schema.Types.Mixed,
    meta: {
      clientIp: String,
      userAgent: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance & idempotency safety
orderSchema.index({ "customer.phone": 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

// Export model
export const Order = model<IOrderDocument, IOrderModel>("Order", orderSchema);
