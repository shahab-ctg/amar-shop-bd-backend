import jwt from "jsonwebtoken";
import { env } from "../env.js";
//  make it a named export (TypeScript friendly)
export function requireAdmin(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith("Bearer ")) {
            return res.status(401).json({ ok: false, code: "NO_TOKEN" });
        }
        const token = header.split(" ")[1];
        const decoded = jwt.verify(token, env.JWT_SECRET);
        if (decoded.role !== "ADMIN") {
            return res.status(403).json({ ok: false, code: "FORBIDDEN" });
        }
        next();
    }
    catch (err) {
        return res.status(401).json({ ok: false, code: "INVALID_TOKEN" });
    }
}
// 👇 keep default export too so either syntax works
export default requireAdmin;
