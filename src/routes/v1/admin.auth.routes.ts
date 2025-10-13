import { Router } from "express";
import { dbConnect } from "../../db/connection.js";
import { Admin } from "../../models/Admin.js";
import { verifyPassword } from "../../utils/hash.js";
import { signAccessToken } from "../../utils/jwt.js";
import { z } from "zod";

const router = Router();

const LoginDTO = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/admin/auth/login", async (req, res, next) => {
  try {
    await dbConnect();
    const { email, password } = LoginDTO.parse(req.body);
    const admin = await Admin.findOne({ email }).lean();
    if (!admin)
      return res.status(401).json({ ok: false, code: "INVALID_CREDENTIALS" });

    const ok = await verifyPassword(password, admin.passwordHash as string);
    if (!ok)
      return res.status(401).json({ ok: false, code: "INVALID_CREDENTIALS" });

    const token = signAccessToken({
      sub: admin._id.toString(),
      email: admin.email,
      role: "ADMIN",
    });
    res.json({ ok: true, data: { accessToken: token } });
  } catch (err) {
    next(err);
  }
});

export default router;
