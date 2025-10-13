import jwt, {
  type Secret,
  type SignOptions,
  type JwtPayload as LibJwtPayload,
} from "jsonwebtoken";
import { env } from "../env.js";

export type AdminJwtPayload = { sub: string; email: string; role: "ADMIN" };

const JWT_SECRET: Secret = (env.JWT_SECRET || "dev_secret_change_me") as Secret;

// ← এখানে টাইপ alias বানালাম
type ExpiresIn = SignOptions["expiresIn"];
const DEFAULT_EXPIRES_IN: ExpiresIn = (env.JWT_EXPIRES_IN ?? "1d") as ExpiresIn;

export function signAccessToken(payload: AdminJwtPayload): string {
  const p: Record<string, unknown> = { ...payload };
  const opts: SignOptions = { expiresIn: DEFAULT_EXPIRES_IN };
  return jwt.sign(p, JWT_SECRET, opts);
}

export function verifyAccessToken(token: string): AdminJwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as LibJwtPayload | string;
  if (typeof decoded === "string")
    throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });

  const { sub, email, role } = decoded as Partial<AdminJwtPayload>;
  if (!sub || !email || role !== "ADMIN")
    throw Object.assign(new Error("FORBIDDEN"), { statusCode: 403 });

  return { sub, email, role: "ADMIN" };
}
