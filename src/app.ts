import express from 'express';
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan"
import products from "./routes/v1/product.routes.js"
import orders from "./routes/v1/order.routes.js";
import health from "./routes/v1/health.routes.js";

import rateLimit from "express-rate-limit"
import { env } from './env.js';
import { errorMiddleware } from './middlewares/error.js';


const app = express();


app.use(helmet())
app.use(cors({origin: env.CORS_ORIGIN || true}));
app.use(morgan(env ? "dev" : "combined"));

app.use(rateLimit({windowMs: 60_000, limit: 120}));
app.use(express.json({limit: "1mb"}))



// Routes===========
app.use("/api/v1", health);
app.use("/api/v1", products)
app.use("/api/v1", orders)

app.use(errorMiddleware)

export default app;


