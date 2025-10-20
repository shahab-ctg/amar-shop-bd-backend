import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

export interface BannerDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  image: string; // absolute/public URL 
  title: string;
  subtitle: string;
  discount?: string; // optional badge like "৩০% ছাড়"
  status: "ACTIVE" | "HIDDEN";
  sort: number; // smaller = higher priority
  createdAt?: Date;
  updatedAt?: Date;
}

const BannerSchema = new Schema<BannerDoc>(
  {
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
  },
  { timestamps: true }
);

BannerSchema.index({ sort: 1, createdAt: -1 });

export const Banner =
  (models.Banner as mongoose.Model<BannerDoc>) ||
  model<BannerDoc>("Banner", BannerSchema);
