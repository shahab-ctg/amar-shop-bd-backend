import { Router } from "express";
const router = Router();
router.get("/health", (_req, res) => res.json({
    ok: true,
    service: "shodaigram-backend",
    ts: new Date().toISOString(),
}));
export default router;
//# sourceMappingURL=health.routes.js.map