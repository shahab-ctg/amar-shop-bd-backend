import { model, models, Schema } from "mongoose";



const OrderSchema = new Schema ( {
  customer: { name: String, email: String, phone: String, address: String, area: String },
  lines: [{ 
    productId: { type: Schema.Types.ObjectId, ref: "Product"},
    title: String, image: String, price: Number, qty: Number
  }],
  totals: { subTotal: Number, shipping: Number, grandTotal: Number},
  status: { type: String, enum: [ "PENDING", "IN_PROGRESS", "IN_SHIPPING", "DELIVERD", "CANCELLED"], default: "PENDING", index: true},

  
},
  {timestamps: true}
)

export const Order = models.Order || model("Order", OrderSchema)