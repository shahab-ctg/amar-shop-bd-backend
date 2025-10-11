
import express from "express";

const app = express();

app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.json({ok: true, service: "Shodaigram-bakcend", ts: new Date().toISOString()})
})

const PORT = Number(process.env.PORT || 3001)

app.listen(PORT, () => {
  console.log(`✅ API running at http://localhost:${PORT}`);})