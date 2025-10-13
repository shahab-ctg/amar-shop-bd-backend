import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

export interface OrderLine {

  productId: mongoose.Types.ObjectId;
  title: string;
  image?: string;
  price: number;
  qty: number;
}

export interface OrderDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    area: string;
  };
  lines: OrderLine[];
  totals: { subTotal: number; shipping: number; grandTotal: number };
  status: "PENDING" | "IN_PROGRESS" | "IN_SHIPPING" | "DELIVERED" | "CANCELLED";
  createdAt?: Date;
  updatedAt?: Date;
}

const OrderSchema = new Schema<OrderDoc>(
  {
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
  },
  { timestamps: true }
);

export const Order =
  (models.Order as mongoose.Model<OrderDoc>) ||
  model<OrderDoc>("Order", OrderSchema);
