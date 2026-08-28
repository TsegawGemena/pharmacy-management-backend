import "dotenv/config";

function isUnresolvedReference(value: string): boolean {
  return value.includes("${{");
}

function resolveDatabaseUrl(): string {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.DATABASE_PRIVATE_URL,
    process.env.DATABASE_PUBLIC_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRESQL_URL,
  ].filter(
    (value): value is string => typeof value === "string" && value.length > 0 && !isUnresolvedReference(value)
  );

  if (candidates[0]) return candidates[0];

  const host =
    process.env.PGHOST ||
    process.env.POSTGRES_HOST ||
    process.env.RAILWAY_PRIVATE_DOMAIN;
  const user = process.env.PGUSER || process.env.POSTGRES_USER;
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  const database =
    process.env.PGDATABASE || process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE;
  const port = process.env.PGPORT || process.env.POSTGRES_PORT || "5432";

  if (host && user && database) {
    const auth = password
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
      : encodeURIComponent(user);
    return `postgresql://${auth}@${host}:${port}/${database}`;
  }

  return "";
}

const databaseUrl = resolveDatabaseUrl();
if (databaseUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

export function databaseEnvKeys(): string[] {
  return Object.keys(process.env).filter((key) =>
    /DATABASE|POSTGRES|^PG/i.test(key)
  );
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  databaseUrl,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  vatRate: Number(process.env.VAT_RATE) || 0.15,
  currency: process.env.CURRENCY || "ETB",
  tz: process.env.TZ || "Africa/Addis_Ababa",
};
