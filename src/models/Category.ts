import { model, models, Schema } from "mongoose";


const CategorySchema = new Schema ({
  title: {type : String, required: true, index: true},
  slug: {type: String, required: true, unique: true},
  image: {type: String},
  status: { type: String, enum: ["ACTIVE", "HIDDEN"], default: "ACTIVE", index: true }
},
{timestamps: true}
);

CategorySchema.index({createdAt: -1});

export const Category = models.Category || model("Category", CategorySchema);

