import "./config/env";
import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  console.log(`Gammo Pharmacy API running on http://localhost:${env.port}/api`);
  console.log(`Health check: http://localhost:${env.port}/api/health`);
});
