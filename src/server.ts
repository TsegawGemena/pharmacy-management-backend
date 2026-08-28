import { createApp } from "./app";
import { env } from "./config/env";
import { ensureSchema } from "./db/ensureSchema";

const app = createApp();

async function start() {
  try {
    await ensureSchema();
  } catch (err) {
    console.error("Database schema bootstrap failed:", err);
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`Gammo Pharmacy API running on http://localhost:${env.port}/api`);
    console.log(`Health check: http://localhost:${env.port}/api/health`);
  });
}

void start();
