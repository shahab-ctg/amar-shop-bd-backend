import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const OrderSchema = new Schema({
    customer: {
        name: String,
        email: String,
        phone: String,
        address: String,
        area: String,
    },
    lines: [
        {
            productId: {
                type: Schema.Types.ObjectId,
                ref: "Product",
                required: true,
            },
            title: String,
            image: String,
            price: Number,
            qty: { type: Number, required: true, min: 1 },
        },
    ],
    totals: { subTotal: Number, shipping: Number, grandTotal: Number },
    status: {
        type: String,
        enum: ["PENDING", "IN_PROGRESS", "IN_SHIPPING", "DELIVERED", "CANCELLED"],
        default: "PENDING",
        index: true,
    },
}, { timestamps: true });
export const Order = models.Order ||
    model("Order", OrderSchema);
