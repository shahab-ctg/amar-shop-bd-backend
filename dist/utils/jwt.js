import jwt from "jsonwebtoken";
import { env } from "../env.js";
const JWT_SECRET = (env.JWT_SECRET || "dev_secret_change_me");
const DEFAULT_EXPIRES_IN = (env.JWT_EXPIRES_IN ?? "1d");
export function signAccessToken(payload) {
    const p = { ...payload };
    const opts = { expiresIn: DEFAULT_EXPIRES_IN };
    return jwt.sign(p, JWT_SECRET, opts);
}
export function verifyAccessToken(token) {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string")
        throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
    const { sub, email, role } = decoded;
    if (!sub || !email || role !== "ADMIN")
        throw Object.assign(new Error("FORBIDDEN"), { statusCode: 403 });
    return { sub, email, role: "ADMIN" };
}
