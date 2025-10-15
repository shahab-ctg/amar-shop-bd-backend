import express from 'express';
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan"
import products from "./routes/v1/product.routes.js"
import orders from "./routes/v1/order.routes.js";
import health from "./routes/v1/health.routes.js";
import categories from "./routes/v1/category.routes.js";
import adminAuth from "./routes/v1/admin.auth.routes.js";
import adminProducts from "./routes/v1/admin.product.routes.js";
import adminCategories from "./routes/v1/admin.category.routes.js";

import rateLimit from "express-rate-limit"
import { env } from './env.js';
import { errorMiddleware } from './middlewares/error.js';


const app = express();


app.use(helmet())
app.use(cors({origin: env.CORS_ORIGIN || true}));
app.use(morgan(env ? "dev" : "combined"));

app.use(rateLimit({windowMs: 60_000, limit: 120}));
app.use(express.json({limit: "1mb"}))


app.use((req, _res, next) => {
  console.log("REQ:", req.method, req.path);
  next();
});

// Routes===========
app.use("/api/v1", health);
app.use("/api/v1", categories);
app.use("/api/v1", products)
app.use("/api/v1", orders)

app.use("/api/v1/admin", adminAuth)
app.use("/api/v1/admin", adminProducts)
app.use("/api/v1/admin", adminCategories)

// app.use((req, _res, next) => {
//   console.log("REQ:", req.method, req.path);
//   next();
// });

app.use((req, res) => {
  res.status(404).json({ ok: false, code: "NOT_FOUND", path: req.originalUrl });
});


app.use(errorMiddleware)

export default app;


