import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const ProductSchema = new Schema({
    title: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true },
    images: { type: [String], default: [] },
    imageIds: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    isDiscounted: { type: Boolean, default: false },
    stock: { type: Number, default: 0 },
    categorySlug: { type: String, index: true },
    brand: { type: String, default: "Generic" },
    description: { type: String, default: "" },
    tagSlugs: [{ type: String, index: true }],
    status: {
        type: String,
        enum: ["ACTIVE", "DRAFT", "HIDDEN"],
        default: "ACTIVE",
        index: true,
    },
}, { timestamps: true });
ProductSchema.index({ createdAt: -1 });
export const Product = models.Product ||
    model("Product", ProductSchema);
