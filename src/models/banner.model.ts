// src/models/Banner.ts
import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

export interface BannerDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  image: string; 
  title?: string;
  subtitle?: string;
  discount?: string; 
  status?: "ACTIVE" | "HIDDEN";
  sort?: number; 
  position?: "hero" | "side";
  createdAt?: Date;
  updatedAt?: Date;
}

const BannerSchema = new Schema<BannerDoc>(
  {
    image: { type: String  },
    title: { type: String},
    subtitle: { type: String },
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
  },
  { timestamps: true }
);

BannerSchema.index({ position: 1, sort: 1, createdAt: -1 });

export const Banner =
  (models.Banner as mongoose.Model<BannerDoc>) ||
  model<BannerDoc>("Banner", BannerSchema);
