import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const CategorySchema = new Schema({
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
}, { timestamps: true });
export const Category = models.Category ||
    model("Category", CategorySchema);
