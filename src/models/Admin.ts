import { timeStamp } from "console";
import { model, models, Schema } from "mongoose";


const AdminSchema = new Schema(
  {
    email: { type: String, unique: true, required: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN"], default: "ADMIN" },
  },

  { timestamps: true }
);

export const Admin = models.Admin || model("Admin", AdminSchema)