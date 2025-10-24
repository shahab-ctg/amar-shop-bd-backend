import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@/utils/jwt.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const hdr = req.header("Authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;

  if (!token)
    return res.status(401).json({ ok: false, message: "Missing token" });

  try {
    const payload = verifyAccessToken(token);

    if (!["ADMIN", "SUPER_ADMIN"].includes(payload.role)) {
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }

    // @ts-ignore
    req.user = payload;
    next();
  } catch (err) {
    console.error("❌ JWT verify failed:", err);
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}
