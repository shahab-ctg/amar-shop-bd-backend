// src/models/Order.ts
import { Schema, model } from "mongoose";
import type { IOrderDocument, IOrderModel } from "../types/mongoose.types";

const orderSchema = new Schema<IOrderDocument>(
  {
    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "IN_SHIPPING", "DELIVERED", "CANCELLED"],
      default: "PENDING",
    },
    lines: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        qty: { type: Number, required: true, min: 1 },
        price: { type: Number, default: 0 },
        image: String,
        title: String,
      },
    ],
    notes: { type: String, default: "" },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
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
  },
  {
    timestamps: true,
  }
);

// Create and export the model
export const Order = model<IOrderDocument, IOrderModel>("Order", orderSchema);
