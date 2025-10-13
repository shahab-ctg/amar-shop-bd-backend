import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

export interface AdminDoc extends mongoose.Document {
  email: string;
  passwordHash: string;
  role: "ADMIN";
}

const AdminSchema = new Schema<AdminDoc>(
  {
    email: { type: String, unique: true, required: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN"], default: "ADMIN" },
  },
  { timestamps: true }
);

export const Admin =
  (models.Admin as mongoose.Model<AdminDoc>) ||
  model<AdminDoc>("Admin", AdminSchema);
