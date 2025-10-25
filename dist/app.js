import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
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
import customerOrders from "./routes/v1/customer.orders.routes.js";
import { env } from "./env.js";
import { errorMiddleware } from "./middlewares/error.js";
const app = express();
//  CORS
app.use(cors({ origin: env.CORS_ORIGINS.split(","), credentials: true }));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
//  Rate limit
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
//  Routes
app.get("/", (req, res) => {
    res.json({
        ok: true,
        message: "🛍 Amar Shop Backend API running",
        timestamp: new Date().toISOString(),
    });
});
app.use("/api/v1", health);
app.use("/api/v1", products);
app.use("/api/v1", orders);
app.use("/api/v1", customerOrders);
app.use("/api/v1", categories);
app.use("/api/v1", uploads);
app.use("/api/v1", banners);
app.use("/api/v1", adminAuth);
app.use("/api/v1/admin", adminProducts);
app.use("/api/v1/admin", adminCategories);
app.use("/api/v1/admin", adminBanners);
app.use((req, res) => res.status(404).json({ ok: false, code: "NOT_FOUND" }));
app.use(errorMiddleware);
export default app;
