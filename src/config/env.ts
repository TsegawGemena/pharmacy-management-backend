import "dotenv/config";

function resolveDatabaseUrl(): string {
  const direct =
    process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL;
  if (direct) return direct;

  const host = process.env.PGHOST || process.env.POSTGRES_HOST;
  const user = process.env.PGUSER || process.env.POSTGRES_USER;
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  const database = process.env.PGDATABASE || process.env.POSTGRES_DB;
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
