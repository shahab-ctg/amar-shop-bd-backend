import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

export interface ProductDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  image?: string;
  price: number;
  compareAtPrice?: number;
  isDiscounted?: boolean;
  stock?: number;
  categorySlug?: string;
  tagSlugs?: string[];
  status: "ACTIVE" | "DRAFT" | "HIDDEN";
  createdAt?: Date;
  updatedAt?: Date;
}

const ProductSchema = new Schema<ProductDoc>(
  {
    title: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true },
    image: String,
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    isDiscounted: { type: Boolean, default: false, index: true },
    stock: { type: Number, default: 0 },
    categorySlug: { type: String, index: true },
    tagSlugs: [{ type: String, index: true }],
    status: {
      type: String,
      enum: ["ACTIVE", "DRAFT", "HIDDEN"],
      default: "ACTIVE",
      index: true,
    },
  },
  { timestamps: true }
);

ProductSchema.index({ createdAt: -1 });

export const Product =
  (models.Product as mongoose.Model<ProductDoc>) ||
  model<ProductDoc>("Product", ProductSchema);
