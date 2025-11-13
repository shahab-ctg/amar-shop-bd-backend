// src/models/Order.js
import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const OrderLineSchema = new Schema({
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    title: String,
    image: String,
    price: Number,
    qty: { type: Number, required: true, min: 1 },
});
const OrderSchema = new Schema({
    customer: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        houseOrVillage: { type: String, default: "" },
        roadOrPostOffice: { type: String, default: "" },
        blockOrThana: { type: String, default: "" },
        district: { type: String, default: "" },
    },
    lines: [OrderLineSchema],
    totals: {
        subTotal: { type: Number, default: 0 },
        shipping: { type: Number, default: 0 },
        grandTotal: { type: Number, default: 0 },
    },
    status: {
        type: String,
        enum: ["PENDING", "IN_PROGRESS", "IN_SHIPPING", "DELIVERED", "CANCELLED"],
        default: "PENDING",
        index: true,
    },
    payment: { type: Schema.Types.Mixed },
    notes: { type: String, default: "" },
}, { timestamps: true });
// index for fast phone lookup
OrderSchema.index({ "customer.phone": 1 });
export const Order = models.Order ? models.Order : model("Order", OrderSchema);
