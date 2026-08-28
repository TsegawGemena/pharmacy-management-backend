import { execSync } from "node:child_process";
import { databaseEnvKeys, env } from "./config/env";

const unresolvedReference =
  process.env.DATABASE_URL && process.env.DATABASE_URL.includes("${{");

if (!env.databaseUrl) {
  const hints = databaseEnvKeys();

  console.error(
    [
      "DATABASE_URL is not configured on this Railway service.",
      "",
      "Fix (do this on pharmacy-management-backend, NOT on Postgres):",
      "1. Open backend service → Variables tab",
      '2. Click "+ New Variable" → "Add Variable Reference"',
      "3. Select service: Postgres",
      "4. Select variable: DATABASE_URL",
      "5. Save, then click Deploy",
      "",
      unresolvedReference
        ? 'Your DATABASE_URL looks like a literal "${{...}}" string. Delete it and re-add using "Add Variable Reference".'
        : null,
      hints.length
        ? `Env keys found on this service: ${hints.join(", ")}`
        : "No database-related env keys were found on this service.",
    ]
      .filter(Boolean)
      .join("\n")
  );
  process.exit(1);
}

process.env.DATABASE_URL = env.databaseUrl;

execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
