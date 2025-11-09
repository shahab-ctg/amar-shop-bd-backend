// // src/models/Banner.ts
// import mongoose from "mongoose";
// const { Schema, model, models } = mongoose;

// export interface BannerDoc extends mongoose.Document {
//   _id: mongoose.Types.ObjectId;
//   image: string; 
//   title?: string;
//   subtitle?: string;
//   discount?: string; 
//   status?: "ACTIVE" | "HIDDEN";
//   sort?: number; 
//   position?: "hero" | "side";
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// const BannerSchema = new Schema<BannerDoc>(
//   {
//     image: { type: String  },
//     title: { type: String},
//     subtitle: { type: String },
//     discount: { type: String },
//     status: {
//       type: String,
//       enum: ["ACTIVE", "HIDDEN"],
//       default: "ACTIVE",
//       index: true,
//     },
//     sort: { type: Number, default: 100, index: true },
//     position: {
//       type: String,
//       enum: ["hero", "side"],
//       default: "hero",
//       index: true,
//     },
//   },
//   { timestamps: true }
// );

// BannerSchema.index({ position: 1, sort: 1, createdAt: -1 });

// export const Banner =
//   (models.Banner as mongoose.Model<BannerDoc>) ||
//   model<BannerDoc>("Banner", BannerSchema);
// models/Banner.js
import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const BannerSchema = new Schema(
  {
    image: { type: String, required: true },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    discount: { type: String, default: "" },
    position: { type: String, enum: ["hero", "side"], default: "hero" },
    status: { type: String, enum: ["ACTIVE", "HIDDEN"], default: "ACTIVE" },
    sort: { type: Number, default: 0 },
    link: { type: String, default: "" },
    categorySlug: { type: String, index: true, default: null }, // category-specific banner
  },
  { timestamps: true }
);

BannerSchema.index({ position: 1, categorySlug: 1, status: 1 });

export const Banner =
  (models.Banner as mongoose.Model<any>) || model("Banner", BannerSchema);
