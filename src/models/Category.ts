import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

export interface CategoryDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  image?: string;
  description?: string;
  status: "ACTIVE" | "HIDDEN";
  createdAt?: Date;
  updatedAt?: Date;
}



const CategorySchema = new Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  image: { type: String, default: "" },
  description: { type: String, default: "" },
  status: { type: String, enum: ["ACTIVE", "HIDDEN"], default: "ACTIVE" },
});
export const Category =
  (models.Category as mongoose.Model<CategoryDoc>) ||
  model<CategoryDoc>("Category", CategorySchema);
