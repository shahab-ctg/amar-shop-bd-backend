
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

// Import routes
import products from "./routes/v1/product.routes.js";
import orders from "./routes/v1/order.routes.js";
import health from "./routes/v1/health.routes.js";
import categories from "./routes/v1/category.routes.js";
import adminAuth from "./routes/v1/admin.auth.routes.js";
import adminProducts from "./routes/v1/admin.product.routes.js";
import adminCategories from "./routes/v1/admin.category.routes.js";
import uploads from "./routes/v1/uploads.routes.js";
import banners from "./routes/v1/banner.routes.js";
import adminBanners from "./routes/v1/admin.banner.routes.js";


import { env } from "./env.js";
import { errorMiddleware } from "./middlewares/error.js";


const app = express();



const corsOptions = {
  origin: (env.CORS_ORIGINS || "http://localhost:3000").split(","),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};


app.use(helmet());
app.use(cors(corsOptions)); 
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 300, 
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      error: "Too many requests, please try again later.",
    },
  })
);

// Health check route (basic)
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Amar Shop Bd Backend",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API Routes
app.use("/api/v1", health);
app.use("/api/v1", products);
app.use("/api/v1", orders);
app.use("/api/v1", categories);
app.use("/api/v1", uploads);
app.use("/api/v1", banners); 

// Admin Routes (protected)
app.use("/api/v1", adminAuth);
app.use("/api/v1/admin", adminProducts);
app.use("/api/v1/admin", adminCategories);
app.use("/api/v1/admin", adminBanners);
// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    code: "NOT_FOUND",
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Error Handler (should be last)
app.use(errorMiddleware);

export default app;
