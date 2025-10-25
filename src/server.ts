import { env } from "./env.js";
import app from "./app.js";

const PORT = Number(env.PORT || 5000);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 CORS Origin: ${env.CORS_ORIGINS}`);
});
