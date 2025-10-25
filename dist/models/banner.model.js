// src/models/Banner.ts
import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
const BannerSchema = new Schema({
    image: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    discount: { type: String },
    status: {
        type: String,
        enum: ["ACTIVE", "HIDDEN"],
        default: "ACTIVE",
        index: true,
    },
    sort: { type: Number, default: 100, index: true },
    position: {
        type: String,
        enum: ["hero", "side"],
        default: "hero",
        index: true,
    },
}, { timestamps: true });
BannerSchema.index({ position: 1, sort: 1, createdAt: -1 });
export const Banner = models.Banner ||
    model("Banner", BannerSchema);
