import { execSync } from "node:child_process";
import { env } from "./config/env";

if (!env.databaseUrl) {
  const hints = [
    "PGHOST",
    "PGUSER",
    "PGDATABASE",
    "DATABASE_PRIVATE_URL",
    "POSTGRES_URL",
  ].filter((key) => process.env[key]);

  console.error(
    [
      "DATABASE_URL is not configured.",
      "",
      "On Railway:",
      "1. Open your backend service → Variables",
      "2. Add reference: DATABASE_URL = ${{Postgres.DATABASE_URL}}",
      "3. Redeploy",
      "",
      hints.length
        ? `Found related vars: ${hints.join(", ")} (but could not build a connection URL)`
        : "No database env vars were found on this service.",
    ].join("\n")
  );
  process.exit(1);
}

process.env.DATABASE_URL = env.databaseUrl;

execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
