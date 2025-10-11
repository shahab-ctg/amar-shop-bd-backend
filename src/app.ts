import express from 'express';
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan"
import {env} from "./env"
import rateLimit from "express-rate-limit"


const app = express();


app.use(helmet())
app.use(cors({origin: env.CORS_ORIGIN || true}));
app.use(morgan(env ? "dev" : "combined"));

app.use(rateLimit({windowMs: 60_000, max: 120}));
app.use(express.json({limit: "1mb`"}))

export default app;


