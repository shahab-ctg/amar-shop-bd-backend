import mongoose from "mongoose";
import z from "zod";

const CreateDTO = z.object({
  name: z.string().min(2), // 🔄 title → name
  slug: z.string().min(2),
  image: z.string().optional(), // Cloudinary image URL
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "HIDDEN"]).optional().default("ACTIVE"),
});

const UpdateDTO = CreateDTO.partial().refine((d) => Object.keys(d).length > 0, {
  message: "At least one field required",
});
type LeanCategory = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  image?: string;
  description?: string;
  status: "ACTIVE" | "HIDDEN";
};
