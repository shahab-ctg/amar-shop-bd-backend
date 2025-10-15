
import express from "express";
import { env } from "./env.js";
import app from "./app.js";



app.use(express.json());

// app.get("/api/v1/health", (_req, res) => {
//   res.json({ok: true, service: "Shodaigram-bakcend", ts: new Date().toISOString()})
// })

const PORT = Number(env.PORT || 5000)

app.listen(PORT, () => {
  console.log(`server is running at http://localhost:${PORT}`);})