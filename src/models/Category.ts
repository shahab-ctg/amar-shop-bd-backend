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

const CategorySchema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    image: { type: String, default: "" },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["ACTIVE", "HIDDEN"],
      default: "ACTIVE",
      index: true,
    },
  },
  { timestamps: true }
);

export const Category =
  (models.Category as mongoose.Model<CategoryDoc>) ||
  model<CategoryDoc>("Category", CategorySchema);
