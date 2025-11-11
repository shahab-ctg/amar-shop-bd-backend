import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";
import products from "./routes/v1/product.routes.js";
// import orders from "./routes/v1/order.routes.js";
import health from "./routes/v1/health.routes.js";
import categories from "./routes/v1/category.routes.js";
import adminAuth from "./routes/v1/admin.auth.routes.js";
import adminProducts from "./routes/v1/admin.product.routes.js";
import adminCategories from "./routes/v1/admin.category.routes.js";
import uploads from "./routes/v1/uploads.routes.js";
import banners from "./routes/v1/banner.routes.js";
import adminBanners from "./routes/v1/admin.banner.routes.js";
import customerOrders from "./routes/v1/customer.orders.routes.js";
import promoRouter from "./routes/v1/promocard.routes.js";
import manufacturerRouter from "./routes/v1/manufacturer.routes.js";
import publicInvoiceRouter from "./routes/v1/invoicePublic.routes.js";
import { env } from "./env.js";
import { errorMiddleware } from "./middlewares/error.js";
import invoiceRouter from "./routes/v1/invoice.routes.js";
import adminInvoicesRouter from "./routes/v1/adminInvoice.routes.js";
import OrdersRouter from "./routes/v1/order.routes.js";
const app = express();
// replace current CORS configuration with this block
const allowedOrigins = (env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
// safer origin checker: DO NOT throw; just disallow by returning false
const corsOptions = {
    origin: function (origin, callback) {
        // allow requests with no origin (curl, server-to-server)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // do NOT throw an error here — tell cors to disallow the origin
        return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    credentials: true,
};
// apply middleware
app.use(cors(corsOptions));
// Ensure preflight requests are handled without throwing
app.options("*", (req, res) => {
    // if origin is allowed, cors middleware will already set AC-Allow-* headers
    // but to be sure, call cors with same options for preflight
    cors(corsOptions)(req, res, () => {
        // send empty success for OPTIONS
        res.status(204).end();
    });
});
app.options("*", cors(corsOptions));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
//  Rate limit
if (process.env.NODE_ENV === "production") {
    const limiter = rateLimit({
        windowMs: 1 * 60 * 1000,
        limit: 500,
        message: "Too many requests, please try again later.",
    });
    app.use(limiter);
}
app.use(bodyParser.json({ limit: "1mb" }));
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
// app.use("/api/v1", orders);
app.use("/api/v1", customerOrders);
app.use("/api/v1", categories);
app.use("/api/v1", banners);
app.use("/api/v1", uploads);
app.use("/api/v1/invoices", publicInvoiceRouter);
app.use("/api/v1", OrdersRouter);
app.use("/api/v1/admin/invoices", adminInvoicesRouter);
app.use("/api/v1/admin/invoices", invoiceRouter);
app.use("/api/v1/admin", adminBanners);
app.use("/api/v1", adminAuth);
app.use("/api/v1/admin", adminProducts);
app.use("/api/v1/admin", adminCategories);
app.use("/api/v1/promocard", promoRouter);
app.use("/api/v1/manufacturer-banners", manufacturerRouter);
app.use((req, res) => res.status(404).json({ ok: false, code: "NOT_FOUND" }));
app.use(errorMiddleware);
export default app;
