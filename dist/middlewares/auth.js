import { verifyAccessToken } from "../utils/jwt.js";
export function requireAdmin(req, res, next) {
    const hdr = req.header("Authorization") || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token)
        return res.status(401).json({ ok: false, code: "UNAUTHORIZED" });
    try {
        const payload = verifyAccessToken(token);
        if (payload.role !== "ADMIN") {
            return res.status(403).json({ ok: false, code: "FORBIDDEN" });
        }
        // @ts-expect-error attach user to req
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ ok: false, code: "UNAUTHORIZED" });
    }
}
