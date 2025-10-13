import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

export interface CategoryDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  image?: string;
  status: "ACTIVE" | "HIDDEN";
  createdAt?: Date;
  updatedAt?: Date;
}

const CategorySchema = new Schema<CategoryDoc>(
  {
    title: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true },
    image: { type: String },
    status: {
      type: String,
      enum: ["ACTIVE", "HIDDEN"],
      default: "ACTIVE",
      index: true,
    },
  },
  { timestamps: true }
);

CategorySchema.index({ createdAt: -1 });

export const Category =
  (models.Category as mongoose.Model<CategoryDoc>) ||
  model<CategoryDoc>("Category", CategorySchema);
